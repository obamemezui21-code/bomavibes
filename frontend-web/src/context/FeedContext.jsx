import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import {
  createPost as createPostDoc,
  deletePost as deletePostDoc,
  fetchFeedPage,
  fetchMyLikedPostIds,
  subscribeToNewPostsCount,
  toggleLike as toggleLikeDoc,
  updatePost as updatePostDoc,
} from '../firebase/feed.js'
import { sortFeedTab } from '../lib/feedRanking.js'
import { sendPushNotification } from '../firebase/notify.js'
import { useAuth } from './AuthContext.jsx'

const FeedContext = createContext(null)

function FeedProvider({ children }) {
  const { user, publicProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('recent')
  const [posts, setPosts] = useState([])
  const [authorsById, setAuthorsById] = useState({})
  const [likedPostIds, setLikedPostIds] = useState(new Set())
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [newPostsCount, setNewPostsCount] = useState(0)

  const myInterests = publicProfile?.interests || []

  const loadTab = useCallback(
    async (tab) => {
      setIsLoading(true)
      try {
        const { posts: fetched, authorsById: authors, nextCursor } = await fetchFeedPage({ tab })
        const ranked = sortFeedTab(tab, fetched, authors, myInterests)
        setPosts(ranked)
        setAuthorsById((prev) => ({ ...prev, ...authors }))
        setCursor(nextCursor)
        setHasMore(!!nextCursor)
        if (user?.id) {
          // Isolated on purpose: e.g. a missing Firestore index for this
          // collection-group query must never take down the feed list itself.
          try {
            const liked = await fetchMyLikedPostIds(user.id)
            setLikedPostIds(liked)
          } catch {
            // Hearts just won't show as already-liked until this resolves.
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  )

  useEffect(() => {
    loadTab(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Watches for posts newer than the newest one currently loaded, so the
  // "X nouveaux posts" banner can appear without polling. The baseline only
  // moves forward when the visible list itself is refreshed (loadTab), not
  // on loadMore — otherwise paging down would silently clear the count.
  useEffect(() => {
    if (isLoading) return
    setNewPostsCount(0)
    const since = posts[0]?.createdAt || null
    const unsubscribe = subscribeToNewPostsCount(since, activeTab, setNewPostsCount)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, posts[0]?.id, activeTab])

  async function loadMore() {
    if (!hasMore || isLoadingMore || activeTab === 'foryou' || activeTab === 'popular') return
    setIsLoadingMore(true)
    try {
      const { posts: fetched, authorsById: authors, nextCursor } = await fetchFeedPage({ tab: activeTab, cursor })
      setPosts((prev) => [...prev, ...sortFeedTab(activeTab, fetched)])
      setAuthorsById((prev) => ({ ...prev, ...authors }))
      setCursor(nextCursor)
      setHasMore(!!nextCursor)
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function createPost(input) {
    if (!user?.id) return
    const postId = await createPostDoc(user.id, input)
    // Shown at the top right away: the publish used to wait for the whole
    // tab to load again (up to 150 posts and their authors) before it was
    // done. The tab still refreshes, in the background.
    setPosts((prev) => [
      {
        id: postId,
        authorId: user.id,
        type: input.type,
        text: input.text || null,
        photoUrl: input.photoUrl || null,
        photoThumbUrl: input.photoThumbUrl || null,
        ...(input.background ? { background: input.background } : {}),
        ...(input.font ? { font: input.font } : {}),
        ...(input.type === 'video' ? { videoUrl: input.videoUrl, posterUrl: input.posterUrl || null, duration: input.duration || null } : {}),
        likeCount: 0,
        commentCount: 0,
        createdAt: Timestamp.now(),
        editedAt: null,
      },
      ...prev.filter((p) => p.id !== postId),
    ])
    if (publicProfile) setAuthorsById((prev) => (prev[user.id] ? prev : { ...prev, [user.id]: { id: user.id, ...publicProfile } }))
    // The post is already written: a failed refresh is never a failed publish.
    loadTab(activeTab).catch(() => {})
    return postId
  }

  async function deletePost(postId) {
    if (!user?.id) return
    await deletePostDoc(postId, user.id)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  async function updatePost(postId, text) {
    if (!user?.id) return
    await updatePostDoc(postId, user.id, text)
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, text, editedAt: true } : p)))
  }

  // Optimistic like/unlike: flip the UI immediately, roll back only on
  // failure — the actual counter always comes from the transaction in
  // firebase/feed.js, this is just responsiveness for the tap.
  async function toggleLikePost(post) {
    if (!user?.id) return
    const wasLiked = likedPostIds.has(post.id)
    setLikedPostIds((prev) => {
      const next = new Set(prev)
      if (wasLiked) next.delete(post.id)
      else next.add(post.id)
      return next
    })
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, likeCount: (p.likeCount || 0) + (wasLiked ? -1 : 1) } : p)),
    )

    try {
      await toggleLikeDoc(post.id, user.id, wasLiked)
      if (!wasLiked && post.authorId !== user.id) {
        sendPushNotification(post.authorId, 'post_like', {
          postId: post.id,
          firstName: user.firstName,
          preview: post.text?.slice(0, 80),
        })
      }
    } catch {
      setLikedPostIds((prev) => {
        const next = new Set(prev)
        if (wasLiked) next.add(post.id)
        else next.delete(post.id)
        return next
      })
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, likeCount: (p.likeCount || 0) + (wasLiked ? 1 : -1) } : p)),
      )
    }
  }

  return (
    <FeedContext.Provider
      value={{
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
        createPost,
        updatePost,
        deletePost,
        toggleLikePost,
        refresh: () => loadTab(activeTab),
      }}
    >
      {children}
    </FeedContext.Provider>
  )
}

function useFeed() {
  const ctx = useContext(FeedContext)
  if (!ctx) throw new Error('useFeed must be used within a FeedProvider')
  return ctx
}

export { FeedProvider, useFeed }
