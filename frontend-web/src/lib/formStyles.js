// Shared form control classes — was duplicated identically across Profile.jsx,
// Onboarding.jsx, Login.jsx, Signup.jsx, Settings.jsx, ForgotPassword.jsx and
// AuthAction.jsx.

export const inputClass =
  'w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white dark:focus:bg-ink/[0.06] focus:ring-4 focus:ring-violet-400/15'

export const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80'

export const chipClass = (selected) =>
  `rounded-full border px-3.5 py-2 text-sm font-medium transition ${
    selected
      ? 'border-violet-400 bg-violet-500/15 text-violet-600'
      : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
  }`
