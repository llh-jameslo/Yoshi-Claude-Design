import { useEffect, useState } from 'react'

/** True on narrow viewports (real phones); keep desktop device frame otherwise. */
export function useCompactViewport(maxWidth = 520) {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${maxWidth}px)`).matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])

  return compact
}
