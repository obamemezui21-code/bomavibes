import { useEffect, useState } from 'react'

// True while the app isn't the thing being looked at: the tab is hidden (app
// switcher, another app, another tab) or the window lost focus (on a computer,
// screenshot tools take the focus). Protected content is then covered, so the
// app switcher's preview and most screenshot tools capture a blur. Focus moving
// into one of our own frames (a map, a captcha) doesn't count.
export default function useScreenShield() {
  const [shielded, setShielded] = useState(() => typeof document !== 'undefined' && document.hidden)

  useEffect(() => {
    const update = () => {
      const inOwnFrame = document.activeElement?.tagName === 'IFRAME'
      setShielded(document.hidden || (!document.hasFocus() && !inOwnFrame))
    }
    // blur fires before focus has moved to a frame: look once it has.
    const onBlur = () => setTimeout(update, 0)
    update()
    document.addEventListener('visibilitychange', update)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', update)
    window.addEventListener('pagehide', update)
    window.addEventListener('pageshow', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', update)
      window.removeEventListener('pagehide', update)
      window.removeEventListener('pageshow', update)
    }
  }, [])

  return shielded
}
