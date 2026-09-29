// Firestore security rules — run with `npm run test:rules` (starts the
// Firestore emulator; needs Java). Each test states who does what and
// whether the rules must allow it.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

let env

// alice ♥ bob (mutual) · carol ♥ bob (one-way) · dave blocked by bob
const MATCH = 'alice_bob'

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bomavibes',
    firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'swipes/alice_bob'), { swiperId: 'alice', targetId: 'bob', direction: 'like' })
    await setDoc(doc(db, 'swipes/bob_alice'), { swiperId: 'bob', targetId: 'alice', direction: 'superlike' })
    await setDoc(doc(db, 'swipes/carol_bob'), { swiperId: 'carol', targetId: 'bob', direction: 'like' })
    await setDoc(doc(db, 'swipes/bob_carol'), { swiperId: 'bob', targetId: 'carol', direction: 'pass' })
    await setDoc(doc(db, `matches/${MATCH}`), {
      users: ['alice', 'bob'],
      lastMessage: null,
      seen: { alice: true, bob: false },
    })
    await setDoc(doc(db, `matches/${MATCH}/messages/fromBob`), { senderId: 'bob', text: 'Salut Alice' })
    await setDoc(doc(db, `matches/${MATCH}/messages/fromAlice`), { senderId: 'alice', text: 'Coucou' })
    await setDoc(doc(db, `matches/${MATCH}/messages/aliceSticker`), { senderId: 'alice', text: '', type: 'sticker', stickerId: 'x' })
    await setDoc(doc(db, 'posts/p1'), { authorId: 'alice', type: 'text', text: 'Bonjour', photoUrl: null, likeCount: 0, commentCount: 0 })
    await setDoc(doc(db, 'posts/styled'), {
      authorId: 'alice', type: 'text', text: 'Stylé', background: 'plum', font: 'script', likeCount: 0, commentCount: 0,
    })
  })
})

const as = (uid) => env.authenticatedContext(uid).firestore()

describe('matches', () => {
  it('can be created with a mutual like (sorted id)', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), `matches/${MATCH}`)))
    await assertSucceeds(
      setDoc(doc(as('alice'), `matches/${MATCH}`), {
        users: ['alice', 'bob'],
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: serverTimestamp(),
        seen: { alice: true, bob: false },
      }),
    )
  })

  it('cannot be created without a like back', async () => {
    await assertFails(
      setDoc(doc(as('carol'), 'matches/bob_carol'), {
        users: ['bob', 'carol'],
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: serverTimestamp(),
        seen: {},
      }),
    )
  })

  it('cannot be created under a made-up id', async () => {
    await assertFails(
      setDoc(doc(as('alice'), 'matches/anything'), { users: ['alice', 'bob'], createdAt: serverTimestamp() }),
    )
  })

  it('is only readable by its two users', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), `matches/${MATCH}`)))
    await assertFails(getDoc(doc(as('carol'), `matches/${MATCH}`)))
  })

  it('lets a participant update chat bookkeeping', async () => {
    await assertSucceeds(
      updateDoc(doc(as('alice'), `matches/${MATCH}`), {
        lastMessage: 'Coucou',
        lastMessageAt: serverTimestamp(),
        'seen.bob': false,
      }),
    )
    await assertSucceeds(updateDoc(doc(as('alice'), `matches/${MATCH}`), { 'typing.alice': serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(as('alice'), `matches/${MATCH}`), { 'activeIn.alice': deleteField() }))
  })

  it("never lets anyone change who is in the match or touch the other person's flags", async () => {
    await assertFails(updateDoc(doc(as('alice'), `matches/${MATCH}`), { users: ['alice', 'bob', 'carol'] }))
    await assertFails(updateDoc(doc(as('alice'), `matches/${MATCH}`), { 'typing.bob': serverTimestamp() }))
    await assertFails(updateDoc(doc(as('alice'), `matches/${MATCH}`), { 'seen.carol': true }))
    await assertFails(updateDoc(doc(as('carol'), `matches/${MATCH}`), { lastMessage: 'spam' }))
  })
})

describe('messages', () => {
  const messages = (uid) => collection(as(uid), `matches/${MATCH}/messages`)

  it('can be sent by a participant, with a known type', async () => {
    await assertSucceeds(addDoc(messages('alice'), { senderId: 'alice', text: 'Hello', createdAt: serverTimestamp() }))
    await assertSucceeds(addDoc(messages('alice'), { senderId: 'alice', text: '', type: 'voice', audioUrl: 'u' }))
    await assertSucceeds(addDoc(messages('alice'), { senderId: 'alice', text: '', type: 'call', call: { type: 'audio', outcome: 'missed', duration: 0 } }))
  })

  it('cannot be sent by an outsider, as someone else, or with an unknown type', async () => {
    await assertFails(addDoc(messages('carol'), { senderId: 'carol', text: 'Hi' }))
    await assertFails(addDoc(messages('alice'), { senderId: 'bob', text: 'Fake' }))
    await assertFails(addDoc(messages('alice'), { senderId: 'alice', text: '', type: 'payment' }))
  })

  it('cannot be sent to someone who blocked you', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'blocks/bob_alice'), { blockerId: 'bob', blockedId: 'alice' }))
    await assertFails(addDoc(messages('alice'), { senderId: 'alice', text: 'Hello?' }))
  })

  it("accepts a reaction to the other person's message (regression)", async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), `matches/${MATCH}/messages/fromBob`), { 'reactions.alice': '❤️' }))
    await assertSucceeds(updateDoc(doc(as('alice'), `matches/${MATCH}/messages/fromBob`), { 'reactions.alice': deleteField() }))
    await assertSucceeds(updateDoc(doc(as('alice'), `matches/${MATCH}/messages/fromAlice`), { 'reactions.alice': '😂' }))
  })

  it("never lets you set someone else's reaction or react as an outsider", async () => {
    await assertFails(updateDoc(doc(as('alice'), `matches/${MATCH}/messages/fromBob`), { 'reactions.bob': '👍' }))
    await assertFails(updateDoc(doc(as('carol'), `matches/${MATCH}/messages/fromBob`), { 'reactions.carol': '👍' }))
  })

  it('lets the sender edit the text of their own text message only', async () => {
    await assertSucceeds(
      updateDoc(doc(as('alice'), `matches/${MATCH}/messages/fromAlice`), { text: 'Coucou !', editedAt: serverTimestamp() }),
    )
    await assertFails(updateDoc(doc(as('alice'), `matches/${MATCH}/messages/fromBob`), { text: 'Rewritten' }))
    await assertFails(updateDoc(doc(as('alice'), `matches/${MATCH}/messages/fromAlice`), { type: 'call' }))
    await assertFails(updateDoc(doc(as('alice'), `matches/${MATCH}/messages/aliceSticker`), { text: 'not a sticker' }))
  })
})

describe('calls', () => {
  const call = (callerId, calleeId, matchId) => ({
    callerId, calleeId, matchId, type: 'video', status: 'ringing', createdAt: serverTimestamp(),
  })

  it('can only be placed between the two people of a match', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'calls'), call('alice', 'bob', MATCH)))
    await assertFails(addDoc(collection(as('carol'), 'calls'), call('carol', 'bob', MATCH)))
    await assertFails(addDoc(collection(as('alice'), 'calls'), call('alice', 'carol', MATCH)))
  })
})

describe('posts', () => {
  const posts = (uid) => collection(as(uid), 'posts')

  it('accepts a styled text post', async () => {
    await assertSucceeds(
      addDoc(posts('bob'), { authorId: 'bob', type: 'text', text: 'Salut', background: 'ocean', font: 'elegant', likeCount: 0, commentCount: 0 }),
    )
  })

  it('rejects oversized style values', async () => {
    await assertFails(
      addDoc(posts('bob'), { authorId: 'bob', type: 'text', text: 'Salut', background: 'x'.repeat(200), likeCount: 0, commentCount: 0 }),
    )
  })

  it('lets the author edit the text but not the style', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'posts/styled'), { text: 'Modifié', editedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as('alice'), 'posts/styled'), { background: 'ocean' }))
  })

  it('lets anyone bump a counter by one, and nothing else', async () => {
    await assertSucceeds(updateDoc(doc(as('bob'), 'posts/p1'), { likeCount: 1 }))
    await assertFails(updateDoc(doc(as('bob'), 'posts/p1'), { likeCount: 50 }))
    await assertFails(updateDoc(doc(as('bob'), 'posts/p1'), { text: 'Hacked' }))
  })
})
