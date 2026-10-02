// Firestore security rules — run with `npm run test:rules` (starts the
// Firestore emulator; needs Java). Each test states who does what and
// whether the rules must allow it.
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, addDoc, collection, deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

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
    await setDoc(doc(db, 'users/alice'), {
      email: 'alice@x.test', onboarded: true, plan: 'vip', planExpiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    })
    await setDoc(doc(db, 'users/bob'), { email: 'bob@x.test', onboarded: true })
    // Members who joined before identity verification became mandatory
    // (legacyMember) keep full access; erin is a new, unverified member.
    await setDoc(doc(db, 'profiles/bob'), { firstName: 'Bob', verified: false, legacyMember: true })
    for (const uid of ['alice', 'carol', 'dave']) {
      await setDoc(doc(db, `profiles/${uid}`), { firstName: uid, verified: false, legacyMember: true })
    }
    await setDoc(doc(db, 'profiles/erin'), { firstName: 'Erin', verified: false })
    await setDoc(doc(db, 'matches/bob_erin'), { users: ['bob', 'erin'], lastMessage: null, seen: { bob: true, erin: true } })
    await setDoc(doc(db, 'posts/p1'), { authorId: 'alice', type: 'text', text: 'Bonjour', photoUrl: null, likeCount: 0, commentCount: 0 })
    await setDoc(doc(db, 'posts/styled'), {
      authorId: 'alice', type: 'text', text: 'Stylé', background: 'plum', font: 'script', likeCount: 0, commentCount: 0,
    })
  })
})

const as = (uid) => env.authenticatedContext(uid).firestore()

describe('matches', () => {
  it('can never be created by the app (the server creates them on a mutual like)', async () => {
    const match = { users: ['bob', 'carol'], createdAt: serverTimestamp(), lastMessage: null, lastMessageAt: serverTimestamp(), seen: {} }
    await assertFails(setDoc(doc(as('carol'), 'matches/bob_carol'), match))
    await assertFails(setDoc(doc(as('alice'), 'matches/anything'), { users: ['alice', 'bob'], createdAt: serverTimestamp() }))
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

describe('profile verification', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'verificationRequests/alice'), { uid: 'alice', status: 'pending', pose: 'peace' }),
    )
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'profiles/alice'), { firstName: 'Alice', verified: false }))
  })

  it('lets a user follow only their own request', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'verificationRequests/alice')))
    await assertFails(getDoc(doc(as('bob'), 'verificationRequests/alice')))
  })

  it('never lets a user approve themselves', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'verificationRequests/alice'), { status: 'approved' }))
    await assertFails(setDoc(doc(as('bob'), 'verificationRequests/bob'), { uid: 'bob', status: 'approved' }))
    await assertFails(updateDoc(doc(as('alice'), 'profiles/alice'), { verified: true }))
  })
})

describe('subscriptions', () => {
  it('lets only subscribers place a call (a free account can still receive one)', async () => {
    const call = (callerId, calleeId) => ({ callerId, calleeId, matchId: MATCH, type: 'audio', status: 'ringing' })
    await assertSucceeds(addDoc(collection(as('alice'), 'calls'), call('alice', 'bob')))
    await assertFails(addDoc(collection(as('bob'), 'calls'), call('bob', 'alice')))
  })

  it('never lets a user give themselves a plan or its perks', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'users/bob'), { plan: 'jade', planExpiresAt: Timestamp.fromMillis(Date.now() + 1e10) }))
    await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { planExpiresAt: Timestamp.fromMillis(Date.now() + 1e10) }))
    await assertFails(updateDoc(doc(as('bob'), 'profiles/bob'), { boostedUntil: Timestamp.fromMillis(Date.now() + 1e7) }))
    await assertFails(updateDoc(doc(as('bob'), 'profiles/bob'), { visibility: 3 }))
    await assertFails(updateDoc(doc(as('bob'), 'profiles/bob'), { invisible: true }))
  })

  it('still lets users edit the rest of their account and profile', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { firstName: 'Alice B.' }))
    await assertSucceeds(updateDoc(doc(as('bob'), 'profiles/bob'), { bio: 'Salut !' }))
  })

  it('keeps likes server-side: no direct writes, and no peeking at who liked you', async () => {
    await assertFails(setDoc(doc(as('carol'), 'swipes/carol_alice'), { swiperId: 'carol', targetId: 'alice', direction: 'like' }))
    await assertSucceeds(getDoc(doc(as('carol'), 'swipes/carol_bob')))
    await assertFails(getDoc(doc(as('bob'), 'swipes/carol_bob')))
  })

  it('lets users read their own quota counters only', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'usage/bob'), { likes: 3 }))
    await assertSucceeds(getDoc(doc(as('bob'), 'usage/bob')))
    await assertFails(getDoc(doc(as('alice'), 'usage/bob')))
    await assertFails(setDoc(doc(as('bob'), 'usage/bob'), { likes: 0 }))
  })
})

describe('posts', () => {
  const posts = (uid) => collection(as(uid), 'posts')

  it('accepts a styled text post', async () => {
    await assertSucceeds(
      addDoc(posts('bob'), { authorId: 'bob', type: 'text', text: 'Salut', background: 'ocean', font: 'elegant', likeCount: 0, commentCount: 0 }),
    )
  })

  it('never lets a user publish a fake official announcement', async () => {
    await assertFails(
      addDoc(posts('bob'), {
        authorId: 'bob', type: 'text', text: 'Promo', likeCount: 0, commentCount: 0,
        announcement: { title: 'Annonce officielle', message: 'Envoyez votre mot de passe' },
      }),
    )
    await assertFails(updateDoc(doc(as('alice'), 'posts/p1'), { announcement: { title: 'Fake', message: 'x' } }))
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

describe('stories', () => {
  const stories = (uid) => collection(as(uid), 'stories')
  // Exactly what StoryComposer / createStory() write.
  const story = (overrides) => ({
    authorId: 'alice',
    type: 'photo',
    text: null,
    background: null,
    photoUrl: 'https://bomavibes.tech/uploads/feed/alice/photo.jpg',
    photoThumbUrl: 'https://bomavibes.tech/uploads/feed/alice/photo-thumb.jpg',
    viewedBy: [],
    createdAt: serverTimestamp(),
    ...overrides,
  })

  it('publishes a photo story without a caption', async () => {
    await assertSucceeds(addDoc(stories('alice'), story()))
  })

  it('publishes a text story on a gradient', async () => {
    await assertSucceeds(
      addDoc(stories('alice'), story({ type: 'text', text: 'Bonne soirée !', background: 'linear-gradient(135deg,#a95dda,#e652a3)', photoUrl: null, photoThumbUrl: null })),
    )
  })

  it('rejects an empty text story or a photo story without a photo', async () => {
    await assertFails(addDoc(stories('alice'), story({ type: 'text', text: '', photoUrl: null, photoThumbUrl: null })))
    await assertFails(addDoc(stories('alice'), story({ photoUrl: null })))
  })

  it('publishes a 30 s video story, not a video story without its file or too long', async () => {
    const video = { type: 'video', photoUrl: null, videoUrl: 'https://bomavibes.tech/uploads/stories/alice/video-1.mp4', duration: 29.6 }
    await assertSucceeds(addDoc(stories('alice'), story(video)))
    await assertFails(addDoc(stories('alice'), story({ ...video, videoUrl: null })))
    await assertFails(addDoc(stories('alice'), story({ ...video, duration: 120 })))
  })

  it("never lets someone post a story as someone else", async () => {
    await assertFails(addDoc(stories('bob'), story()))
  })

  describe('reactions and comments', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'stories/s1'), { ...story(), createdAt: Timestamp.now() })
      })
    })
    const reaction = (emoji) => ({ emoji, createdAt: serverTimestamp() })
    const comment = (authorId, text = 'Trop beau 😍') => ({ authorId, text, createdAt: serverTimestamp() })

    it('lets a viewer react with an allowed emoji, for themselves only', async () => {
      await assertSucceeds(setDoc(doc(as('bob'), 'stories/s1/reactions/bob'), reaction('❤️')))
      await assertSucceeds(setDoc(doc(as('bob'), 'stories/s1/reactions/bob'), reaction('🔥')))
      await assertFails(setDoc(doc(as('bob'), 'stories/s1/reactions/bob'), reaction('💩')))
      await assertFails(setDoc(doc(as('bob'), 'stories/s1/reactions/carol'), reaction('❤️')))
    })

    it('keeps reactions private to the reacting person and the author', async () => {
      await setDoc(doc(as('bob'), 'stories/s1/reactions/bob'), reaction('❤️'))
      await assertSucceeds(getDoc(doc(as('bob'), 'stories/s1/reactions/bob')))
      await assertSucceeds(getDoc(doc(as('alice'), 'stories/s1/reactions/bob')))
      await assertFails(getDoc(doc(as('carol'), 'stories/s1/reactions/bob')))
    })

    it('lets anyone comment as themselves, within 300 characters', async () => {
      await assertSucceeds(addDoc(collection(as('bob'), 'stories/s1/comments'), comment('bob')))
      await assertFails(addDoc(collection(as('bob'), 'stories/s1/comments'), comment('carol')))
      await assertFails(addDoc(collection(as('bob'), 'stories/s1/comments'), comment('bob', 'x'.repeat(301))))
      await assertFails(addDoc(collection(as('bob'), 'stories/s1/comments'), comment('bob', '')))
    })

    it('stops someone blocked by the author (or blocking them) from reacting or commenting', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'blocks/alice_carol'), { blockerId: 'alice', blockedId: 'carol' })
      })
      await assertFails(setDoc(doc(as('carol'), 'stories/s1/reactions/carol'), reaction('❤️')))
      await assertFails(addDoc(collection(as('carol'), 'stories/s1/comments'), comment('carol')))
      await assertSucceeds(setDoc(doc(as('bob'), 'stories/s1/reactions/bob'), reaction('❤️')))
    })

    it('lets the commenter or the story author delete a comment, nobody else', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'stories/s1/comments/c1'), { authorId: 'bob', text: 'Salut', createdAt: Timestamp.now() })
        await setDoc(doc(ctx.firestore(), 'stories/s1/comments/c2'), { authorId: 'bob', text: 'Salut', createdAt: Timestamp.now() })
      })
      await assertFails(deleteDoc(doc(as('carol'), 'stories/s1/comments/c1')))
      await assertSucceeds(deleteDoc(doc(as('bob'), 'stories/s1/comments/c1')))
      await assertSucceeds(deleteDoc(doc(as('alice'), 'stories/s1/comments/c2')))
    })
  })
})

describe('mandatory identity verification', () => {
  it('stops a new unverified member from writing, publishing or commenting', async () => {
    await assertFails(addDoc(collection(as('erin'), 'matches/bob_erin/messages'), { senderId: 'erin', text: 'Salut', type: 'text' }))
    await assertFails(addDoc(collection(as('erin'), 'posts'), { authorId: 'erin', type: 'text', text: 'Hello', likeCount: 0, commentCount: 0 }))
    await assertFails(addDoc(collection(as('erin'), 'posts/p1/comments'), { authorId: 'erin', text: 'Super' }))
    await assertFails(setDoc(doc(as('erin'), 'posts/p1/likes/erin'), { createdAt: serverTimestamp() }))
  })

  it('lets them in once verified, and legacy members all along', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'profiles/erin'), { verified: true }))
    await assertSucceeds(addDoc(collection(as('erin'), 'matches/bob_erin/messages'), { senderId: 'erin', text: 'Salut', type: 'text' }))
    await assertSucceeds(addDoc(collection(as('bob'), 'matches/bob_erin/messages'), { senderId: 'bob', text: 'Coucou', type: 'text' }))
  })

  it('never lets anyone grant or remove the legacy exemption themselves', async () => {
    await assertFails(updateDoc(doc(as('erin'), 'profiles/erin'), { legacyMember: true }))
    await assertFails(updateDoc(doc(as('bob'), 'profiles/bob'), { legacyMember: false }))
  })
})
