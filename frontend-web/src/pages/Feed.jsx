import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Image as ImageIcon, Plus, Send } from 'lucide-react'
import { useFeed } from '../context/FeedContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { recordSwipeAndMatch } from '../firebase/swipes.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { deleteStory, markStoryViewed, subscribeToActiveStories } from '../firebase/stories.js'
import { matchPercent } from '../lib/interests.js'
import { CONTENT_REPORT_REASONS } from '../lib/reportReasons.js'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import FeedTabs from '../components/feed/FeedTabs.jsx'
import PostCard from '../components/feed/PostCard.jsx'
import PostComposer from '../components/feed/PostComposer.jsx'
import StoryComposer from '../components/feed/StoryComposer.jsx'
import StoryViewer from '../components/feed/StoryViewer.jsx'
import EditPostModal from '../components/feed/EditPostModal.jsx'
import SendToModal from '../components/feed/SendToModal.jsx'
import FeedEmptyState from '../components/feed/FeedEmptyState.jsx'
import ProfileDetailModal from '../components/ProfileDetailModal.jsx'
import ReportModal from '../components/ReportModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

function Feed() {
  const {
    activeTab,
    setActiveTab,
    posts,
    authorsById,
    likedPostIds,
    hasMore,
    isLoading,
    isLoadingMore,
    newPostsCount,
    loadMore,
    deletePost,
    updatePost,
    toggleLikePost,
    refresh,
  } = useFeed()
  const { user, publicProfile } = useAuth()
  const { conversations } = useConversations()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [showComposer, setShowComposer] = useState(false)
  const [composerType, setComposerType] = useState('text')
  const [expandedAuthorId, setExpandedAuthorId] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)
  const [isSubmittingSafety, setIsSubmittingSafety] = useState(false)
  const [stories, setStories] = useState([])
  const [storyAuthorsById, setStoryAuthorsById] = useState({})
  const [showStoryComposer, setShowStoryComposer] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [storyReportTarget, setStoryReportTarget] = useState(null)
  const [storyDeleteTarget, setStoryDeleteTarget] = useState(null)
  const [isSubmittingStorySafety, setIsSubmittingStorySafety] = useState(false)
  const sentinelRef = useRef(null)

  useEffect(() => {
    const unsubscribe = subscribeToActiveStories((fetchedStories, authors) => {
      setStories(fetchedStories)
      setStoryAuthorsById((prev) => ({ ...prev, ...authors }))
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hasMore])

  const expandedProfile = expandedAuthorId ? authorsById[expandedAuthorId] : null
  const expandedMatch = expandedAuthorId ? conversations.find((c) => c.otherUid === expandedAuthorId) : null

  async function handleLike(profile) {
    await recordSwipeAndMatch(user.id, profile.id, 'like', user.firstName)
  }
  async function handlePass(profile) {
    await recordSwipeAndMatch(user.id, profile.id, 'pass', user.firstName)
  }

  async function handleReportSubmit(reason, description, alsoBlock) {
    if (!reportTarget) return
    setIsSubmittingSafety(true)
    try {
      await reportUser(user.id, reportTarget.authorId, reason, description, { postId: reportTarget.id })
      if (alsoBlock) await blockUser(user.id, reportTarget.authorId)
      showToast('Signalement envoyé. Merci de nous aider à garder BomaVibes sûr.', 'success')
      setReportTarget(null)
    } catch {
      showToast("Impossible d'envoyer le signalement, réessayez.", 'error')
    } finally {
      setIsSubmittingSafety(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsSubmittingSafety(true)
    try {
      await deletePost(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      showToast('Impossible de supprimer cette publication, réessayez.', 'error')
    } finally {
      setIsSubmittingSafety(false)
    }
  }

  async function handleShowNewPosts() {
    await refresh()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openComposer(type = 'text') {
    setComposerType(type)
    setShowComposer(true)
  }

  const myPhoto = publicProfile?.photos?.[0]
  const myAvatarUrl = myPhoto
    ? photoVariant(myPhoto, 'thumb')
    : `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(user?.firstName || user?.id || '')}&backgroundColor=f3e8ff,fce7f3,ede9fe`

  const myStories = useMemo(
    () => stories.filter((s) => s.authorId === user?.id).slice().reverse(),
    [stories, user],
  )

  const otherStoryGroups = useMemo(() => {
    const map = new Map()
    for (const s of stories) {
      if (s.authorId === user?.id) continue
      if (!map.has(s.authorId)) map.set(s.authorId, [])
      map.get(s.authorId).push(s)
    }
    return [...map.entries()].map(([authorId, list]) => ({
      author: storyAuthorsById[authorId],
      stories: [...list].reverse(),
      allViewed: list.every((s) => (s.viewedBy || []).includes(user?.id)),
    }))
  }, [stories, storyAuthorsById, user])

  const storyGroups = useMemo(() => {
    if (myStories.length === 0) return otherStoryGroups
    return [
      { author: publicProfile ? { ...publicProfile, id: user?.id } : null, stories: myStories, allViewed: true },
      ...otherStoryGroups,
    ]
  }, [otherStoryGroups, myStories, publicProfile, user])

  function handleStoryViewed(story) {
    if (!user?.id || story.authorId === user.id) return
    if ((story.viewedBy || []).includes(user.id)) return
    markStoryViewed(story.id, user.id).catch(() => {})
  }

  async function confirmDeleteStory() {
    if (!storyDeleteTarget) return
    setIsSubmittingStorySafety(true)
    try {
      await deleteStory(storyDeleteTarget.id, user.id)
      setStoryDeleteTarget(null)
    } catch {
      showToast('Impossible de supprimer cette story, réessayez.', 'error')
    } finally {
      setIsSubmittingStorySafety(false)
    }
  }

  async function handleReportStorySubmit(reason, description, alsoBlock) {
    if (!storyReportTarget) return
    setIsSubmittingStorySafety(true)
    try {
      await reportUser(user.id, storyReportTarget.authorId, reason, description, { storyId: storyReportTarget.id })
      if (alsoBlock) await blockUser(user.id, storyReportTarget.authorId)
      showToast('Signalement envoyé. Merci de nous aider à garder BomaVibes sûr.', 'success')
      setStoryReportTarget(null)
    } catch {
      showToast("Impossible d'envoyer le signalement, réessayez.", 'error')
    } finally {
      setIsSubmittingStorySafety(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-ink">Actualités</h1>
        <p className="mt-0.5 text-sm text-ink-soft/70">Partagez vos moments BomaVibes ✨</p>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => (myStories.length > 0 ? setViewerIndex(0) : setShowStoryComposer(true))}
              className={`block rounded-full p-[2px] ${
                myStories.length > 0
                  ? 'bg-gradient-to-br from-pink-500 to-violet-500'
                  : 'border-2 border-dashed border-violet-400/50'
              }`}
            >
              {myStories.length > 0 ? (
                <img
                  src={myAvatarUrl}
                  onError={myPhoto ? fallbackToFullPhoto(myPhoto) : undefined}
                  alt=""
                  className="h-14 w-14 rounded-full border-2 border-surface-soft object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full text-violet-500">
                  <Plus size={22} strokeWidth={2.25} />
                </span>
              )}
            </button>
            {myStories.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowStoryComposer(true)
                }}
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white ring-2 ring-surface-soft"
                aria-label="Ajouter une story"
              >
                <Plus size={11} strokeWidth={3} />
              </button>
            )}
          </div>
          <span className="max-w-[4rem] truncate text-xs font-medium text-ink-soft/70">
            {myStories.length > 0 ? 'Vous' : 'Ajouter'}
          </span>
        </div>

        {otherStoryGroups.map((g, i) => {
          const authorPhoto = g.author?.photos?.[0]
          const avatarUrl = authorPhoto
            ? photoVariant(authorPhoto, 'thumb')
            : `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(g.author?.firstName || 'Bomavibes')}&backgroundColor=f3e8ff,fce7f3,ede9fe`
          return (
            <button
              key={g.stories[0]?.authorId || i}
              type="button"
              onClick={() => setViewerIndex(myStories.length > 0 ? i + 1 : i)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span
                className={`block rounded-full p-[2px] ${
                  g.allViewed ? 'bg-ink/15' : 'bg-gradient-to-br from-pink-500 to-violet-500'
                }`}
              >
                <img
                  src={avatarUrl}
                  onError={authorPhoto ? fallbackToFullPhoto(authorPhoto) : undefined}
                  alt=""
                  className="h-14 w-14 rounded-full border-2 border-surface-soft object-cover"
                />
              </span>
              <span className="max-w-[4rem] truncate text-xs font-medium text-ink-soft/70">
                {g.author?.firstName || '…'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-ink/8 bg-white p-3 shadow-sm dark:bg-surface-tint">
        <img src={myAvatarUrl} onError={myPhoto ? fallbackToFullPhoto(myPhoto) : undefined} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        <button
          type="button"
          onClick={() => openComposer('text')}
          className="min-w-0 flex-1 truncate rounded-full bg-ink/[0.04] px-3.5 py-2 text-left text-sm text-ink-soft/60"
        >
          Partage quelque chose... ✨
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => openComposer('photo')}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-ink-soft/60 transition hover:bg-ink/5 hover:text-violet-600"
        >
          <ImageIcon size={16} strokeWidth={2.25} className="text-pink-500" />
          Photo
        </button>
        <button
          type="button"
          onClick={() => openComposer('text')}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-1.5 text-sm font-semibold text-ink-on-brand shadow-md shadow-violet-500/25"
        >
          Publier
          <Send size={13} strokeWidth={2.5} />
        </button>
      </div>

      <div className="mt-5">
        <FeedTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <AnimatePresence>
        {newPostsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <button
              type="button"
              onClick={handleShowNewPosts}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25"
            >
              <ArrowUp size={14} strokeWidth={2.5} />
              {newPostsCount === 1 ? '1 nouveau post' : `${newPostsCount}${newPostsCount >= 50 ? '+' : ''} nouveaux posts`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
        </div>
      ) : posts.length === 0 ? (
        <FeedEmptyState onCreate={() => setShowComposer(true)} />
      ) : (
        <div className="mt-4 space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={authorsById[post.authorId]}
              isLiked={likedPostIds.has(post.id)}
              onToggleLike={() => toggleLikePost(post)}
              onAuthorClick={() => setExpandedAuthorId(post.authorId)}
              onOpen={() => navigate(`/feed/${post.id}`)}
              currentUserId={user?.id}
              onDelete={() => setDeleteTarget(post)}
              onEdit={() => setEditTarget(post)}
              onReport={() => setReportTarget(post)}
              onShare={() =>
                setShareTarget({
                  postId: post.id,
                  authorId: post.authorId,
                  authorName: authorsById[post.authorId]?.firstName || '',
                  text: (post.text || '').slice(0, 300),
                  photoUrl: post.photoThumbUrl || post.photoUrl || null,
                })
              }
            />
          ))}
          <div ref={sentinelRef} />
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showComposer && <PostComposer initialType={composerType} onClose={() => setShowComposer(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showStoryComposer && user?.id && (
          <StoryComposer userId={user.id} onClose={() => setShowStoryComposer(false)} />
        )}
      </AnimatePresence>

      {viewerIndex !== null && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          startGroupIndex={viewerIndex}
          currentUserId={user?.id}
          onClose={() => setViewerIndex(null)}
          onViewed={handleStoryViewed}
          onDelete={(story) => {
            setViewerIndex(null)
            setStoryDeleteTarget(story)
          }}
          onReport={(story) => {
            setViewerIndex(null)
            setStoryReportTarget(story)
          }}
        />
      )}

      {storyReportTarget && (
        <ReportModal
          title="Signaler cette story"
          reasons={CONTENT_REPORT_REASONS}
          onClose={() => setStoryReportTarget(null)}
          onSubmit={handleReportStorySubmit}
          isSubmitting={isSubmittingStorySafety}
        />
      )}

      <AnimatePresence>
        {storyDeleteTarget && (
          <ConfirmDialog
            title="Supprimer cette story ?"
            description="Cette action est définitive et ne peut pas être annulée."
            confirmLabel="Supprimer"
            isConfirming={isSubmittingStorySafety}
            onCancel={() => setStoryDeleteTarget(null)}
            onConfirm={confirmDeleteStory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTarget && (
          <EditPostModal
            post={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={(text) => updatePost(editTarget.id, text)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedProfile && (
          <ProfileDetailModal
            profile={expandedProfile}
            matchPercent={matchPercent(publicProfile?.interests, expandedProfile.interests)}
            onClose={() => setExpandedAuthorId(null)}
            onLike={() => handleLike(expandedProfile)}
            onPass={() => handlePass(expandedProfile)}
            matchId={expandedMatch?.id || null}
            isSelf={expandedAuthorId === user?.id}
          />
        )}
      </AnimatePresence>

      {reportTarget && (
        <ReportModal
          title="Signaler cette publication"
          reasons={CONTENT_REPORT_REASONS}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReportSubmit}
          isSubmitting={isSubmittingSafety}
        />
      )}

      {shareTarget && <SendToModal post={shareTarget} onClose={() => setShareTarget(null)} />}

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            title="Supprimer cette publication ?"
            description="Cette action est définitive et ne peut pas être annulée."
            confirmLabel="Supprimer"
            isConfirming={isSubmittingSafety}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleConfirmDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Feed
