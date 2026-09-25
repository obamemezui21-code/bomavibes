import { useEffect, useState } from 'react'

// `qrcode` is loaded on demand — most page views never render a ticket card.
function TicketQr({ value, size = 64 }) {
  const [dataUrl, setDataUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((mod) => {
        const QRCode = mod.default ?? mod
        return QRCode.toDataURL(value, { margin: 0, width: size * 4, color: { dark: '#261b28' } })
      })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [value, size])

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink/10 bg-white p-1"
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt="QR code du billet" className="h-full w-full" />
      ) : (
        <div className="h-full w-full animate-pulse rounded bg-ink/5" />
      )}
    </div>
  )
}

export default TicketQr
