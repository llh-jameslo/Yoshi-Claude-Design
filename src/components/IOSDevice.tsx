import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCompactViewport } from '../hooks/useCompactViewport'
import { isTextField } from '../lib/fakeKeyboardInput'
import { IOSStatusBar } from './IOSStatusBar'
import { IOSKeyboard } from './IOSKeyboard'

const KB_ANIM_MS = 340
const KB_HEIGHT = 336

type Props = {
  children: ReactNode
  width?: number
  height?: number
  dark?: boolean
  /**
   * Optional override. When omitted on desktop, the fake keyboard follows
   * text-field focus inside the frame (show on focus, hide on outside tap).
   */
  keyboard?: boolean
}

function shouldKeepKeyboard(t: Element) {
  return Boolean(
    t.closest('[data-ios-keyboard], [data-keep-keyboard], input, textarea'),
  )
}

export function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  keyboard,
}: Props) {
  const compact = useCompactViewport()
  const rootRef = useRef<HTMLDivElement>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [kbMounted, setKbMounted] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)

  const wantKeyboard =
    !compact && (keyboard !== undefined ? keyboard : inputFocused)

  useEffect(() => {
    if (compact) {
      setInputFocused(false)
      return
    }
    const root = rootRef.current
    if (!root) return

    const onFocusIn = (e: FocusEvent) => {
      if (isTextField(e.target)) setInputFocused(true)
    }

    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && root.contains(next) && isTextField(next)) {
        setInputFocused(true)
        return
      }
      // Let keyboard / keep-keyboard pointer handlers run first
      window.setTimeout(() => {
        const active = document.activeElement
        if (active && root.contains(active) && isTextField(active)) {
          setInputFocused(true)
          return
        }
        setInputFocused(false)
      }, 0)
    }

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t || !root.contains(t)) return

      // Taps on the field, its chrome, or the keyboard must never dismiss
      if (shouldKeepKeyboard(t)) {
        const keepHost = t.closest('[data-keep-keyboard]')
        if (keepHost && !isTextField(t) && !t.closest('input, textarea')) {
          const field = keepHost.querySelector('input, textarea')
          if (field instanceof HTMLElement) {
            e.preventDefault()
            field.focus()
          }
        }
        return
      }

      const active = document.activeElement
      if (active && root.contains(active) && isTextField(active)) {
        active.blur()
        setInputFocused(false)
      }
    }

    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)
    root.addEventListener('pointerdown', onPointerDown)
    return () => {
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
      root.removeEventListener('pointerdown', onPointerDown)
    }
  }, [compact])

  // Smooth mount → slide in / slide out → unmount
  useEffect(() => {
    if (wantKeyboard) {
      setKbMounted(true)
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setKbOpen(true))
      })
      return () => window.cancelAnimationFrame(id)
    }
    setKbOpen(false)
    const t = window.setTimeout(() => setKbMounted(false), KB_ANIM_MS)
    return () => window.clearTimeout(t)
  }, [wantKeyboard])

  return (
    <div
      ref={rootRef}
      className={compact ? 'ios-device ios-device--compact' : 'ios-device'}
      style={{
        width: compact ? '100%' : width,
        height: compact ? '100%' : height,
        maxWidth: compact ? '100%' : width,
        maxHeight: compact ? '100%' : height,
        borderRadius: compact ? 0 : 48,
        overflow: 'hidden',
        position: 'relative',
        background: dark ? '#000' : '#F2F0F8',
        boxShadow: compact
          ? 'none'
          : '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
        fontFamily: '-apple-system, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        ['--chrome-top' as string]: compact
          ? 'max(8px, env(safe-area-inset-top, 0px))'
          : '54px',
        ['--nav-top' as string]: compact
          ? 'max(10px, env(safe-area-inset-top, 0px))'
          : '64px',
        ['--flow-pad-top' as string]: compact
          ? 'calc(var(--chrome-top) + 44px)'
          : '110px',
        ['--action-bottom' as string]: compact ? '14px' : '48px',
        ['--safe-bottom' as string]: compact
          ? 'env(safe-area-inset-bottom, 0px)'
          : '0px',
      }}
    >
      <div
        className="ios-device-chrome ios-device-island"
        aria-hidden
        style={{
          display: compact ? 'none' : 'block',
          position: 'absolute',
          top: 11,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 126,
          height: 37,
          borderRadius: 24,
          background: '#000',
          zIndex: 50,
        }}
      />
      <div
        className="ios-device-chrome ios-device-statusbar"
        style={{
          display: compact ? 'none' : 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <IOSStatusBar dark={dark} />
      </div>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>
        {!compact && kbMounted ? (
          <div
            aria-hidden={!kbOpen}
            style={{
              flex: 'none',
              height: kbOpen ? KB_HEIGHT : 0,
              // Clip only while collapsing so key-preview bubbles can paint above keys
              overflow: kbOpen ? 'visible' : 'hidden',
              transition: `height ${KB_ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
              willChange: 'height',
              position: 'relative',
              zIndex: 20,
            }}
          >
            <div
              style={{
                height: KB_HEIGHT,
                transform: kbOpen ? 'translateY(0)' : 'translateY(18%)',
                opacity: kbOpen ? 1 : 0.85,
                transition: `transform ${KB_ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${KB_ANIM_MS * 0.85}ms ease`,
                willChange: 'transform, opacity',
                overflow: 'visible',
              }}
            >
              <IOSKeyboard dark={dark} />
            </div>
          </div>
        ) : null}
      </div>
      <div
        className="ios-device-chrome ios-device-home"
        aria-hidden
        style={{
          display: compact ? 'none' : 'flex',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          height: 34,
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingBottom: 8,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 139,
            height: 5,
            borderRadius: 100,
            background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)',
          }}
        />
      </div>
    </div>
  )
}
