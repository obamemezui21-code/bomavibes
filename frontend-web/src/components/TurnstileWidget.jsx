import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Cloudflare Turnstile — mostly invisible anti-bot check for the signup form.
// The site key is public by design; its secret half lives only in the
// backend .env (TURNSTILE_SECRET) and is checked by POST /api/auth/register.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAFKJHbJt9TsmKl7a'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise = null
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.async = true
      script.onload = () => resolve(window.turnstile)
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('turnstile script failed to load'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

// onToken(token) fires with a fresh token, and with '' when it expires or
// fails. ref.reset() asks for a new one (tokens are single-use).
const TurnstileWidget = forwardRef(function TurnstileWidget({ onToken }, ref) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onTokenRef = useRef(onToken)
  // Script blocked (ad blocker, weak network) or challenge error: without
  // this the form just waited forever for a token that would never come.
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current?.('')
      if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current)
    },
  }))

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          language: 'fr',
          theme: 'auto',
          size: 'flexible',
          retry: 'auto',
          'refresh-expired': 'auto',
          callback: (token) => {
            setFailed(false)
            onTokenRef.current?.(token)
          },
          'expired-callback': () => onTokenRef.current?.(''),
          'error-callback': () => {
            onTokenRef.current?.('')
            setFailed(true)
          },
        })
      })
      .catch(() => {
        onTokenRef.current?.('')
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (widgetIdRef.current !== null) window.turnstile?.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [attempt])

  return (
    <div>
      <div ref={containerRef} className="min-h-[65px]" />
      {failed && (
        <p className="mt-1 text-xs text-coral-400">
          La vérification anti-robot ne se charge pas. Vérifiez votre connexion ou désactivez votre bloqueur de pub,
          puis{' '}
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              setAttempt((a) => a + 1)
            }}
            className="font-semibold underline"
          >
            réessayez
          </button>
          .
        </p>
      )}
    </div>
  )
})

export default TurnstileWidget
