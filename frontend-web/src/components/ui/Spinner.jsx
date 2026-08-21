const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
}

function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      className={`${SIZES[size]} animate-spin rounded-full border-violet-400/30 border-t-violet-500 ${className}`}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface">
      <Spinner size="lg" />
    </div>
  )
}

export default Spinner
