const TABS = [
  { id: 'foryou', label: 'Pour vous' },
  { id: 'recent', label: 'Récent' },
  { id: 'popular', label: 'Populaire' },
  { id: 'questions', label: 'Questions' },
]

function FeedTabs({ activeTab, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            activeTab === tab.id
              ? 'border-violet-400 bg-violet-500/15 text-violet-600'
              : 'border-ink/12 text-ink-soft/60 hover:bg-ink/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default FeedTabs
