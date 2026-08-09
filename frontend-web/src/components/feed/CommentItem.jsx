import { Flag, Trash2 } from 'lucide-react'
import { fallbackToFullPhoto, photoVariant } from '../../lib/photoVariants.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'

function CommentRow({ comment, author, currentUserId, onReply, onDelete, onReport, onAuthorClick, isReply }) {
  const isOwn = comment.authorId === currentUserId
  const fullPhoto = author?.photos?.[0]
  const avatarUrl = fullPhoto
    ? photoVariant(fullPhoto, 'thumb')
    : `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(author?.firstName || comment.authorId)}&backgroundColor=f3e8ff,fce7f3,ede9fe`

  return (
    <div className={`flex min-w-0 gap-2.5 ${isReply ? 'ml-10' : ''}`}>
      <button type="button" onClick={() => onAuthorClick?.(comment.authorId)} className="shrink-0">
        <img
          src={avatarUrl}
          onError={fullPhoto ? fallbackToFullPhoto(fullPhoto) : undefined}
          alt={author?.firstName || ''}
          className="h-8 w-8 rounded-full object-cover"
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="min-w-0 max-w-full rounded-2xl bg-ink/6 px-3.5 py-2">
          <button type="button" onClick={() => onAuthorClick?.(comment.authorId)} className="text-left text-sm font-semibold text-ink hover:underline">
            {author?.firstName || 'Quelqu’un'}
          </button>
          <p className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{comment.text}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-1 text-xs text-ink-soft/50">
          <span>{formatRelativeTime(comment.createdAt)}</span>
          {!isReply && (
            <button type="button" onClick={() => onReply?.(comment)} className="font-semibold hover:text-violet-600">
              Répondre
            </button>
          )}
          {isOwn ? (
            <button type="button" onClick={() => onDelete?.(comment)} className="flex items-center gap-1 hover:text-coral-500">
              <Trash2 size={12} strokeWidth={2.25} />
              Supprimer
            </button>
          ) : (
            <button type="button" onClick={() => onReport?.(comment)} className="flex items-center gap-1 hover:text-ink">
              <Flag size={12} strokeWidth={2.25} />
              Signaler
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentItem({ comment, author, replies, authorsById, currentUserId, onReply, onDelete, onReport, onAuthorClick }) {
  return (
    <div className="space-y-2.5">
      <CommentRow
        comment={comment}
        author={author}
        currentUserId={currentUserId}
        onReply={onReply}
        onDelete={onDelete}
        onReport={onReport}
        onAuthorClick={onAuthorClick}
      />
      {replies?.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          author={authorsById?.[reply.authorId]}
          currentUserId={currentUserId}
          onDelete={onDelete}
          onReport={onReport}
          onAuthorClick={onAuthorClick}
          isReply
        />
      ))}
    </div>
  )
}

export default CommentItem
