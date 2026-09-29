import { useEffect } from 'react'
import { backgroundTextSize, hasCustomStyle, loadPostFonts, postBackground, postFont } from '../../lib/postStyles.js'

// Body of a text post: plain paragraph, or the chosen font and/or coloured
// background (Facebook / WhatsApp-style). Used in the feed card, the post
// page and the composer's live preview.
function PostText({ text, background, font, clamp = false, className = '', placeholder }) {
  const bg = postBackground(background)
  const f = postFont(font)
  const styled = hasCustomStyle({ background, font })

  useEffect(() => {
    if (styled) loadPostFonts()
  }, [styled])

  const fontStyle = f ? { fontFamily: f.family, fontWeight: f.weight } : undefined
  const content = text || placeholder || ''

  if (bg) {
    return (
      <div
        className={`flex min-h-[200px] w-full items-center justify-center rounded-2xl px-6 py-8 text-center ${className}`}
        style={{ background: bg.css, color: bg.text }}
      >
        <p
          className={`min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] ${backgroundTextSize(content.length)} ${
            clamp ? 'line-clamp-6' : ''
          } ${text ? '' : 'opacity-60'}`}
          style={{ fontWeight: 700, ...fontStyle }}
        >
          {content}
        </p>
      </div>
    )
  }

  return (
    <p
      className={`min-w-0 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere] ${
        f && f.id !== 'normal' ? 'text-[17px]' : 'text-sm'
      } ${text ? 'text-ink' : 'text-ink-soft/50'} ${className}`}
      style={fontStyle}
    >
      {content}
    </p>
  )
}

export default PostText
