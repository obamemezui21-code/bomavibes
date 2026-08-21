import Button from './Button.jsx'

function EmptyState({ icon: Icon, title, description, actionLabel, onAction, children }) {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 p-6 text-center">
      {Icon && <Icon size={40} strokeWidth={1.5} className="text-ink-soft/40" />}
      {title && <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>}
      {description && <p className="max-w-xs text-sm text-ink-soft/70">{description}</p>}
      {children}
      {actionLabel && (
        <Button className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
