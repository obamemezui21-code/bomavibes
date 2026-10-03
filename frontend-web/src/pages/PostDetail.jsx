import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Heart, MessageCircle, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useConversations } from '../context/ConversationsContext.jsx'
import { useFeed } from '../context/FeedContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  addComment,
  batchFetchAuthorProfiles,
  deleteComment,
  hasLiked,
  subscribeToComments,
  subscribeToPost,
} from '../firebase/feed.js'
import { sendPushNotification } from '../firebase/notify.js'
import { recordSwipeAndMatch } from '../firebase/swipes.js'
import { blockUser, reportUser } from '../firebase/safety.js'
import { matchPercent } from '../lib/interests.js'
import { CONTENT_REPORT_REASONS } from '../lib/reportReasons.js'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { formatRelativeTime } from '../lib/relativeTime.js'
import CommentItem from '../components/feed/CommentItem.jsx'
import CommentComposer from '../components/feed/CommentComposer.jsx'
import EditPostModal from '../components/feed/EditPostModal.jsx'
import PostText from '../components/feed/PostText.jsx'
import ProfileDetailModal from '../components/ProfileDetailModal.jsx'
import ReportModal from '../components/ReportModal.jsx'
import SendToModal from '../components/shared/SendToModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { fallbackAvatar } from '../lib/fallbackAvatar.js'
import { useIdentity } from '../context/IdentityContext.jsx'

function PostDetail() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const { user, publicProfile } = useAuth()
  const { conversations, sendPostMessage, blockedIds, refreshBlockedIds } = useConversations()
  const { deletePost, updatePost, toggleLikePost, likedPostIds, authorsById: feedAuthorsById } = useFeed()
  const { showToast } = useToast()
  const { requireIdentity } = useIdentity()

  const [post, setPost] = useState(undefined) // undefined = loading, null = not found
  const [author, setAuthor] = useState(null)
  const [allComments, setComments] = useState([])
  // Comments from someone blocked either way are hidden.
  const comments = useMemo(() => allComments.filter((c) => !blockedIds.has(c.authorId)), [allComments, blockedIds])
  const [commentAuthorsById, setCommentAuthorsById] = useState({})
  const [replyTarget, setReplyTarget] = useState(null)
  const [expandedAuthorId, setExpandedAuthorId] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmittingSafety, setIsSubmittingSafety] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToPost(postId, setPost)
    return unsubscribe
  }, [postId])

  useEffect(() => {
    if (!post) return
    const cached = feedAuthorsById[post.authorId]
    if (cached) {
      setAuthor(cached)
      return
    }
    batchFetchAuthorProfiles([post.authorId]).then((map) => setAuthor(map[post.authorId] || null))
  }, [post, feedAuthorsById])

  useEffect(() => {
    const unsubscribe = subscribeToComments(postId, setComments)
    return unsubscribe
  }, [postId])

  useEffect(() => {
    const ids = comments.map((c) => c.authorId)
    if (ids.length === 0) return
    const missing = ids.filter((id) => !commentAuthorsById[id] && !feedAuthorsById[id])
    if (missing.length === 0) return
    batchFetchAuthorProfiles(missing).then((map) => setCommentAuthorsById((prev) => ({ ...prev, ...map })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments])

  const authorsById = { ...commentAuthorsById, ...feedAuthorsById }

  const [isLikedLocal, setIsLikedLocal] = useState(false)
  useEffect(() => {
    if (!user?.id || !postId) return
    if (likedPostIds.has(postId)) {
      setIsLikedLocal(true)
      return
    }
    hasLiked(postId, user.id).then(setIsLikedLocal)
  }, [postId, user?.id, likedPostIds])

  const topLevelComments = useMemo(() => comments.filter((c) => !c.parentCommentId), [comments])
  const repliesByParent = useMemo(() => {
    const map = {}
    comments.forEach((c) => {
      if (c.parentCommentId) {
        map[c.parentCommentId] = map[c.parentCommentId] || []
        map[c.parentCommentId].push(c)
      }
    })
    return map
  }, [comments])

  async function handleToggleLike() {
    if (!post || !requireIdentity()) return
    setIsLikedLocal((v) => !v)
    await toggleLikePost({ ...post, id: postId })
  }

  async function handleAddComment(text) {
    if (!user?.id || !post) return
    if (!requireIdentity()) return false // keeps the typed comment
    const parentCommentId = replyTarget ? replyTarget.parentCommentId || replyTarget.id : null
    await addComment(postId, user.id, text, parentCommentId)
    setReplyTarget(null)

    const notifyTargetId = replyTarget ? replyTarget.authorId : post.authorId
    if (notifyTargetId !== user.id) {
      sendPushNotification(notifyTargetId, replyTarget ? 'comment_reply' : 'post_comment', {
        postId,
        firstName: user.firstName,
        text: text.slice(0, 120),
      })
    }
  }

  async function handleDeleteComment(comment) {
    if (!user?.id) return
    try {
      await deleteComment(postId, comment.id, user.id)
    } catch {
      showToast('Impossible de supprimer ce commentaire, réessayez.', 'error')
    }
  }

  async function handleAuthorClick(uid) {
    setExpandedAuthorId(uid)
  }

  async function handleLike(profile) {
    if (!requireIdentity()) return
    try {
      const matchId = await recordSwipeAndMatch(user.id, profile.id, 'like', user.firstName)
      if (matchId) showToast(`C'est un match avec ${profile.firstName} !`, 'success')
    } catch (err) {
      // Quota reached (free plan) or network error — the server says which.
      showToast(err.message || "Impossible d'enregistrer votre choix, réessayez.", 'error')
    }
  }
  async function handlePass(profile) {
    try {
      await recordSwipeAndMatch(user.id, profile.id, 'pass', user.firstName)
    } catch {
      showToast("Impossible d'enregistrer votre choix, réessayez.", 'error')
    }
  }

  async function handleReportPostSubmit(reason, description, alsoBlock) {
    setIsSubmittingSafety(true)
    try {
      await reportUser(user.id, post.authorId, reason, description, { postId })
      if (alsoBlock) {
        await blockUser(user.id, post.authorId)
        refreshBlockedIds()
      }
      showToast('Signalement envoyé. Merci de nous aider à garder BomaVibes sûr.', 'success')
      setReportTarget(null)
    } catch {
      showToast("Impossible d'envoyer le signalement, réessayez.", 'error')
    } finally {
      setIsSubmittingSafety(false)
    }
  }

  async function handleReportCommentSubmit(reason, description, alsoBlock) {
    if (!reportTarget?.comment) return
    setIsSubmittingSafety(true)
    try {
      await reportUser(user.id, reportTarget.comment.authorId, reason, description, { postId, commentId: reportTarget.comment.id })
      if (alsoBlock) {
        await blockUser(user.id, reportTarget.comment.authorId)
        refreshBlockedIds()
      }
      showToast('Signalement envoyé. Merci de nous aider à garder BomaVibes sûr.', 'success')
      setReportTarget(null)
    } catch {
      showToast("Impossible d'envoyer le signalement, réessayez.", 'error')
    } finally {
      setIsSubmittingSafety(false)
    }
  }

  async function handleConfirmDeletePost() {
    setIsSubmittingSafety(true)
    try {
      await deletePost(postId)
      navigate('/feed')
    } catch {
      showToast('Impossible de supprimer cette publication, réessayez.', 'error')
    } finally {
      setIsSubmittingSafety(false)
    }
  }

  if (post === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
      </div>
    )
  }

  if (post === null || blockedIds.has(post.authorId)) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-ink-soft/70">Cette publication n'existe plus.</p>
        <button type="button" onClick={() => navigate('/feed')} className="text-sm font-semibold text-violet-600 hover:underline">
          Retour au Feed
        </button>
      </div>
    )
  }

  const isOwn = post.authorId === user?.id
  const fullPhoto = author?.photos?.[0]
  const avatarUrl = fullPhoto
    ? photoVariant(fullPhoto, 'thumb')
    : fallbackAvatar(author?.firstName || post.authorId, 'f3e8ff,fce7f3,ede9fe')

  const expandedProfile = expandedAuthorId ? authorsById[expandedAuthorId] : null
  const expandedMatch = expandedAuthorId ? conversations.find((c) => c.otherUid === expandedAuthorId) : null

  return (
    <div className="flex h-[calc(100dvh_-_5rem_-_env(safe-area-inset-bottom))] flex-col overflow-x-hidden bg-surface-soft md:h-svh">
      <div className="flex shrink-0 items-center gap-3 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/feed')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-ink">Publication</h1>
        <button
          type="button"
          onClick={() => setIsSharing(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-ink/5"
          aria-label="Envoyer en message"
        >
          <Send size={16} strokeWidth={2.25} />
        </button>
        {isOwn && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm font-semibold text-ink-soft/60 hover:text-ink"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(post)}
              className="text-sm font-semibold text-coral-500 hover:underline"
            >
              Supprimer
            </button>
          </div>
        )}
        {!isOwn && (
          <button type="button" onClick={() => setReportTarget({ post: true })} className="text-sm font-semibold text-ink-soft/60 hover:text-ink">
            Signaler
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => handleAuthorClick(post.authorId)}>
              <img src={avatarUrl} onError={fullPhoto ? fallbackToFullPhoto(fullPhoto) : undefined} alt="" className="h-10 w-10 rounded-full object-cover" />
            </button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => handleAuthorClick(post.authorId)} className="truncate text-left text-sm font-semibold text-ink hover:underline">
                {author?.firstName || 'Quelqu’un'}
              </button>
              <p className="truncate text-xs text-ink-soft/50">
                {formatRelativeTime(post.createdAt)}
                {post.editedAt && ' · modifié'}
              </p>
            </div>
          </div>

          {post.text &&
            (post.photoUrl || post.type === 'question' ? (
              <p className="mt-3 min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{post.text}</p>
            ) : (
              <PostText text={post.text} background={post.background} font={post.font} className="mt-3" />
            ))}

          {post.type === 'video' && post.videoUrl && (
            <div className="mt-3 w-full overflow-hidden rounded-xl bg-black">
              <video
                src={post.videoUrl}
                poster={post.posterUrl || undefined}
                controls
                playsInline
                preload="metadata"
                className="max-h-[32rem] w-full"
              />
            </div>
          )}

          {post.photoUrl && (
            <div className="mt-3 max-h-[32rem] w-full overflow-hidden rounded-xl bg-ink/5">
              <img src={post.photoUrl} alt="" className="max-h-[32rem] w-full object-cover" />
            </div>
          )}

          <div className="mt-3 flex items-center gap-4 border-b border-ink/8 pb-4">
            <button
              type="button"
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 text-sm font-medium transition ${isLikedLocal ? 'text-heart-500' : 'text-ink-soft/60 hover:text-heart-500'}`}
            >
              <Heart size={17} strokeWidth={2.25} fill={isLikedLocal ? 'currentColor' : 'none'} />
              {post.likeCount || 0}
            </button>
            <span className="flex items-center gap-1.5 text-sm font-medium text-ink-soft/60">
              <MessageCircle size={17} strokeWidth={2.25} />
              {post.commentCount || 0}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {topLevelComments.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft/50">Aucun commentaire pour l'instant.</p>
            ) : (
              topLevelComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  author={authorsById[comment.authorId]}
                  replies={repliesByParent[comment.id]}
                  authorsById={authorsById}
                  currentUserId={user?.id}
                  onReply={setReplyTarget}
                  onDelete={handleDeleteComment}
                  onReport={(c) => setReportTarget({ comment: c })}
                  onAuthorClick={handleAuthorClick}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <CommentComposer
        replyTarget={replyTarget}
        replyAuthorName={replyTarget ? authorsById[replyTarget.authorId]?.firstName : null}
        onCancelReply={() => setReplyTarget(null)}
        onSubmit={handleAddComment}
      />

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

      {isSharing && (
        <SendToModal
          onSend={(matchId) =>
            sendPostMessage(matchId, {
              postId,
              authorId: post.authorId,
              authorName: author?.firstName || '',
              text: (post.text || '').slice(0, 300),
              photoUrl: post.photoThumbUrl || post.photoUrl || post.posterUrl || null,
            })
          }
          onClose={() => setIsSharing(false)}
        />
      )}

      {reportTarget?.post && (
        <ReportModal
          title="Signaler cette publication"
          reasons={CONTENT_REPORT_REASONS}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReportPostSubmit}
          isSubmitting={isSubmittingSafety}
        />
      )}
      {reportTarget?.comment && (
        <ReportModal
          title="Signaler ce commentaire"
          reasons={CONTENT_REPORT_REASONS}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReportCommentSubmit}
          isSubmitting={isSubmittingSafety}
        />
      )}

      <AnimatePresence>
        {isEditing && (
          <EditPostModal
            post={post}
            onClose={() => setIsEditing(false)}
            onSave={(text) => updatePost(postId, text)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            title="Supprimer cette publication ?"
            description="Cette action est définitive et ne peut pas être annulée."
            confirmLabel="Supprimer"
            isConfirming={isSubmittingSafety}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleConfirmDeletePost}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default PostDetail
