import { Newspaper } from 'lucide-react'
import EmptyState from '../ui/EmptyState.jsx'

function FeedEmptyState({ onCreate }) {
  return (
    <EmptyState
      icon={Newspaper}
      title="Le Feed est encore calme 👀"
      description="Soyez parmi les premiers à partager quelque chose."
      actionLabel="Créer une publication"
      onAction={onCreate}
    />
  )
}

export default FeedEmptyState
