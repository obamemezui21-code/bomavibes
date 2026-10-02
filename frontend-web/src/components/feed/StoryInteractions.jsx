import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, Heart, MessageCircle, Send, SmilePlus, Trash2, X } from 'lucide-react'
import {
  STORY_REACTIONS,
  addStoryComment,
  deleteStoryComment,
  setStoryReaction,
  subscribeToMyStoryReaction,
  subscribeToStoryComments,
  subscribeToStoryReactions,
} from '../../firebase/stories.js'
import { batchFetchAuthorProfiles } from '../../firebase/feed.js'
import { fallbackToFullPhoto } from '../../lib/photoVariants.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'
import { useConversations } from '../../context/ConversationsContext.jsx'
import { useIdentity } from '../../context/IdentityContext.jsx'

const MAX_COMMENT = 300

function Avatar({ profile, size = 'h-8 w-8' }) {
  const photo = profile?.photos?.[0]
  return photo ? (
    <img src={photo} onError={fallbackToFullPhoto(photo)} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white`}>
      {profile?.firstName?.[0] || '?'}
    </span>
  )
}

// Likes, emoji reactions and comments on the story being watched, plus the
// author's "Activité" sheet (who viewed, who reacted). `onPause(true)`
// holds the story while the person is typing or reading a sheet.
function StoryInteractions({ story, isOwn, currentUserId, onPause }) {
  const [myReaction, setMyReaction] = useState(null)
  const [reactions, setReactions] = useState({})
  const [allComments, setComments] = useState([])
  const { blockedIds } = useConversations()
  const { requireIdentity } = useIdentity()
  const comments = allComments.filter((c) => !blockedIds.has(c.authorId))
  const [sheet, setSheet] = useState(null) // 'comments' | 'activity' | null
  const [showEmojis, setShowEmojis] = useState(false)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentFlash, setSentFlash] = useState(false)
  const [burst, setBurst] = useState(null)
  const [viewers, setViewers] = useState([])

  const burstCount = useRef(0)

  // Mounted once per story (keyed on its id by StoryViewer), so every
  // piece of state above starts fresh for each one.
  useEffect(() => {
    const unsubs = [subscribeToStoryComments(story.id, setComments)]
    if (isOwn) unsubs.push(subscribeToStoryReactions(story.id, setReactions))
    else unsubs.push(subscribeToMyStoryReaction(story.id, currentUserId, setMyReaction))
    return () => unsubs.forEach((u) => u())
  }, [story.id, isOwn, currentUserId])

  const interacting = !!sheet || showEmojis || typing
  useEffect(() => {
    onPause(interacting)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interacting])

  // The author's activity sheet lists every viewer, with their reaction.
  useEffect(() => {
    if (sheet !== 'activity') return
    const ids = [...new Set([...(story.viewedBy || []), ...Object.keys(reactions)])]
    let cancelled = false
    batchFetchAuthorProfiles(ids).then((byId) => {
      if (cancelled) return
      // Reactions first, then plain views.
      const list = ids.map((id) => ({ id, profile: byId[id], emoji: reactions[id] || null }))
      list.sort((a, b) => (b.emoji ? 1 : 0) - (a.emoji ? 1 : 0))
      setViewers(list)
    })
    return () => {
      cancelled = true
    }
  }, [sheet, story.viewedBy, reactions])

  function handleReact(emoji) {
    if (!requireIdentity()) return
    setShowEmojis(false)
    const next = myReaction === emoji ? null : emoji
    setMyReaction(next)
    if (next) setBurst({ emoji: next, key: ++burstCount.current })
    setStoryReaction(story, currentUserId, next).catch(() => setMyReaction(myReaction))
  }

  async function send(e) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sending || !requireIdentity()) return
    setSending(true)
    try {
      await addStoryComment(story, currentUserId, text.slice(0, MAX_COMMENT))
      setDraft('')
      if (sheet !== 'comments') {
        setSentFlash(true)
        setTimeout(() => setSentFlash(false), 1500)
      }
    } catch {
      // keep the draft so nothing typed is lost
    } finally {
      setSending(false)
    }
  }

  const reactionCount = Object.keys(reactions).length
  const commentInput = (
    <form onSubmit={send} className="flex flex-1 items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setTyping(true)}
        onBlur={() => setTyping(false)}
        maxLength={MAX_COMMENT}
        placeholder={sentFlash ? 'Commentaire envoyé ✓' : 'Commenter…'}
        className="min-w-0 flex-1 rounded-full border border-white/40 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/70 backdrop-blur-sm focus:border-white focus:outline-none"
      />
      {draft.trim() && (
        <button
          type="submit"
          disabled={sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white disabled:opacity-60"
          aria-label="Envoyer"
        >
          <Send size={17} />
        </button>
      )}
    </form>
  )

  return (
    <>
      {/* Big emoji floating up after a reaction */}
      <AnimatePresence>
        {burst && (
          <motion.span
            key={burst.key}
            initial={{ opacity: 0, scale: 0.3, y: 40 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.4, 1.2, 1.6], y: [40, 0, -20, -120] }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            onAnimationComplete={() => setBurst(null)}
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 text-8xl drop-shadow-2xl"
          >
            {burst.emoji}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AnimatePresence>
          {showEmojis && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-2 flex justify-around rounded-full bg-black/55 px-2 py-2 backdrop-blur-md"
            >
              {STORY_REACTIONS.map((emoji) => (
                <motion.button
                  key={emoji}
                  type="button"
                  whileTap={{ scale: 1.4 }}
                  onClick={() => handleReact(emoji)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl ${myReaction === emoji ? 'bg-white/25' : ''}`}
                  aria-label={`Réagir ${emoji}`}
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isOwn ? (
          <button
            type="button"
            onClick={() => setSheet('activity')}
            className="mx-auto flex items-center gap-3 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md"
          >
            <span className="flex items-center gap-1">
              <Eye size={16} /> {(story.viewedBy || []).length}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={16} /> {reactionCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={16} /> {comments.length}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {commentInput}
            {!draft.trim() && (
              <>
                <button
                  type="button"
                  onClick={() => setSheet('comments')}
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  aria-label="Voir les commentaires"
                >
                  <MessageCircle size={24} />
                  {comments.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-pink-500 px-1 text-[10px] font-bold leading-[18px]">
                      {comments.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmojis((v) => !v)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  aria-label="Réagir"
                >
                  {myReaction && myReaction !== '❤️' ? <span className="text-2xl">{myReaction}</span> : <SmilePlus size={24} />}
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 1.3 }}
                  onClick={() => handleReact('❤️')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  aria-label={myReaction === '❤️' ? 'Je n’aime plus' : 'J’aime'}
                >
                  <Heart size={26} className={myReaction === '❤️' ? 'fill-pink-500 text-pink-500' : ''} />
                </motion.button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Comments / activity sheet */}
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheet(null)}
              className="absolute inset-0 z-40 bg-black/40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 z-50 flex max-h-[70%] flex-col rounded-t-3xl bg-zinc-900 text-white"
            >
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <div className="flex gap-4 text-sm font-semibold">
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => setSheet('activity')}
                      className={sheet === 'activity' ? 'text-white' : 'text-white/50'}
                    >
                      Vues et réactions
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSheet('comments')}
                    className={sheet === 'comments' ? 'text-white' : 'text-white/50'}
                  >
                    Commentaires ({comments.length})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-3">
                {sheet === 'activity' ? (
                  viewers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-white/60">Personne n’a encore vu ce statut.</p>
                  ) : (
                    <ul className="space-y-3 py-1">
                      {viewers.map((v) => (
                        <li key={v.id} className="flex items-center gap-3">
                          <Avatar profile={v.profile} size="h-10 w-10" />
                          <span className="flex-1 truncate text-sm font-medium">{v.profile?.firstName || 'Quelqu’un'}</span>
                          {v.emoji ? <span className="text-2xl">{v.emoji}</span> : <Eye size={16} className="text-white/40" />}
                        </li>
                      ))}
                    </ul>
                  )
                ) : comments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/60">
                    {isOwn ? 'Pas encore de commentaire.' : 'Soyez le premier à commenter 💬'}
                  </p>
                ) : (
                  <ul className="space-y-3 py-1">
                    {comments.map((c) => (
                      <li key={c.id} className="flex items-start gap-3">
                        <Avatar profile={c.author} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white/60">
                            <span className="font-semibold text-white">{c.author?.firstName || 'Quelqu’un'}</span>{' '}
                            {formatRelativeTime(c.createdAt)}
                          </p>
                          <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{c.text}</p>
                        </div>
                        {(c.authorId === currentUserId || isOwn) && (
                          <button
                            type="button"
                            onClick={() => deleteStoryComment(story.id, c.id).catch(() => {})}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-coral-400"
                            aria-label="Supprimer le commentaire"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {sheet === 'comments' && (
                <div className="flex gap-2 border-t border-white/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  {commentInput}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default StoryInteractions
