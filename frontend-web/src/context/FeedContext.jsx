import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  createPost as createPostDoc,
  deletePost as deletePostDoc,
  fetchFeedPage,
  fetchMyLikedPostIds,
  toggleLike as toggleLikeDoc,
} from '../firebase/feed.js'
import { sortForYou, sortPopular } from '../lib/feedRanking.js'
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

  const myInterests = publicProfile?.interests || []

  const loadTab = useCallback(
    async (tab) => {
      setIsLoading(true)
      try {
        const { posts: fetched, authorsById: authors, nextCursor } = await fetchFeedPage({ tab })
        const ranked = tab === 'foryou' ? sortForYou(fetched, authors, myInterests) : tab === 'popular' ? sortPopular(fetched) : fetched
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

  async function loadMore() {
    if (!hasMore || isLoadingMore || activeTab === 'foryou' || activeTab === 'popular') return
    setIsLoadingMore(true)
    try {
      const { posts: fetched, authorsById: authors, nextCursor } = await fetchFeedPage({ tab: activeTab, cursor })
      setPosts((prev) => [...prev, ...fetched])
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
    // The post is already written at this point — a failure past this line
    // (e.g. the feed refresh) must never be reported as a failed publish.
    try {
      await loadTab(activeTab)
    } catch {
      // Best-effort refresh; the new post will show up next time the tab loads.
    }
    return postId
  }

  async function deletePost(postId) {
    if (!user?.id) return
    await deletePostDoc(postId, user.id)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
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
        sendPushNotification(post.authorId, 'post_like', { firstName: user.firstName, preview: post.text?.slice(0, 80) })
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
        loadMore,
        createPost,
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
