import { useEffect, useState } from 'react'

function readCompact() {
  if (typeof window === 'undefined') return false
  const narrow = window.matchMedia('(max-width: 520px)').matches
  const short = window.matchMedia('(max-height: 520px)').matches
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  // Phones (incl. landscape) should never show the desktop device chrome.
  const phoneLike = touch && Math.min(window.innerWidth, window.innerHeight) < 550
  return narrow || short || phoneLike
}

/** True on real phones; keep desktop device frame otherwise. */
export function useCompactViewport() {
  const [compact, setCompact] = useState(readCompact)

  useEffect(() => {
    const update = () => setCompact(readCompact())
    update()
    const mqs = [
      window.matchMedia('(max-width: 520px)'),
      window.matchMedia('(max-height: 520px)'),
      window.matchMedia('(hover: none) and (pointer: coarse)'),
    ]
    mqs.forEach((mq) => mq.addEventListener('change', update))
    window.addEventListener('resize', update)
    return () => {
      mqs.forEach((mq) => mq.removeEventListener('change', update))
      window.removeEventListener('resize', update)
    }
  }, [])

  return compact
}
