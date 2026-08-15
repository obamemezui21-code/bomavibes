import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Plus } from 'lucide-react'
import { useFeed } from '../context/FeedContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { recordSwipeAndMatch } from '../firebase/swipes.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { matchPercent } from '../lib/interests.js'
import { CONTENT_REPORT_REASONS } from '../lib/reportReasons.js'
import FeedTabs from '../components/feed/FeedTabs.jsx'
import PostCard from '../components/feed/PostCard.jsx'
import PostComposer from '../components/feed/PostComposer.jsx'
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
  const [expandedAuthorId, setExpandedAuthorId] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)
  const [isSubmittingSafety, setIsSubmittingSafety] = useState(false)
  const sentinelRef = useRef(null)

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">Feed</h1>
          <p className="mt-0.5 text-sm text-ink-soft/70">Découvrez ce que la communauté partage aujourd'hui.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25"
        >
          <Plus size={16} strokeWidth={2.5} />
          Publier
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
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25"
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
        {showComposer && <PostComposer onClose={() => setShowComposer(false)} />}
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
