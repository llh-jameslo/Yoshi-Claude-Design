import { useEffect, useState } from 'react'

/**
 * Pixels covered by the on-screen keyboard (Visual Viewport resize only).
 * Ignores visualViewport scroll — that was making docked CTAs jump while scrolling.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      // Prefer height delta only; avoid offsetTop so rubber-band scroll doesn't move the CTA.
      const covered = Math.max(0, window.innerHeight - vv.height)
      setInset(covered > 80 ? Math.round(covered) : 0)
    }

    update()
    vv.addEventListener('resize', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return inset
}

/** Freeze page / visual-viewport scrolling while the keyboard is open. */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevBodyTouch = body.style.touchAction
    const prevHtmlOverscroll = html.style.overscrollBehavior

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'
    html.style.overscrollBehavior = 'none'
    html.dataset.kbLock = 'on'
    window.scrollTo(0, 0)

    const allowTarget = (t: EventTarget | null) => {
      if (!(t instanceof Element)) return false
      return Boolean(t.closest('input, textarea, button, [data-allow-touch]'))
    }

    const onTouchMove = (e: TouchEvent) => {
      if (allowTarget(e.target)) return
      e.preventDefault()
    }

    const onVvScroll = () => {
      window.scrollTo(0, 0)
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    window.visualViewport?.addEventListener('scroll', onVvScroll)

    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.touchAction = prevBodyTouch
      html.style.overscrollBehavior = prevHtmlOverscroll
      delete html.dataset.kbLock
      document.removeEventListener('touchmove', onTouchMove)
      window.visualViewport?.removeEventListener('scroll', onVvScroll)
    }
  }, [locked])
}
