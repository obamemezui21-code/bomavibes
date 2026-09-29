import { motion } from 'framer-motion'

const TABS = [
  { id: 'foryou', label: 'Pour vous' },
  { id: 'recent', label: 'Récent' },
  { id: 'popular', label: 'Populaire' },
  { id: 'questions', label: 'Questions' },
]

// Segmented control: one pill track, with the active highlight sliding
// between tabs (shared layoutId) instead of each tab toggling its own border.
function FeedTabs({ activeTab, onChange }) {
  return (
    <div className="flex rounded-full bg-ink/[0.05] p-1">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative min-w-0 flex-1 truncate rounded-full px-2 py-1.5 text-sm font-medium transition-colors ${
              isActive ? 'text-ink' : 'text-ink-soft/60 hover:text-ink'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="feed-tab-highlight"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-surface-tint"
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default FeedTabs
