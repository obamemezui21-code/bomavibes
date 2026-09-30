import { useEffect, useRef, useState } from 'react'

// Scroll-reveal for the public site: fades/slides an element in the first
// time it enters the viewport. One IntersectionObserver + a CSS keyframe
// animation (compositor thread) — cheaper than framer-motion's whileInView,
// which animated every card from JavaScript and made fast scrolling janky on
// phones. The animation (not a transition) leaves the element's own hover
// transitions untouched. See .bv-reveal in index.css.
//   from: 'up' | 'left' | 'scale'   delay: seconds
function Reveal({ as: Tag = 'div', from = 'up', delay = 0, className = '', style, children, ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -60px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`bv-reveal bv-reveal-${from} ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}s`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export default Reveal
