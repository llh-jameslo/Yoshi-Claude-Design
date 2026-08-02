import type { ReactNode } from 'react'
import { useCompactViewport } from '../hooks/useCompactViewport'
import { IOSStatusBar } from './IOSStatusBar'
import { IOSKeyboard } from './IOSKeyboard'

type Props = {
  children: ReactNode
  width?: number
  height?: number
  dark?: boolean
  keyboard?: boolean
}

export function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  keyboard = false,
}: Props) {
  const compact = useCompactViewport()

  return (
    <div
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
        // Compact: tighter chrome + content top so pages aren’t wasted below the progress bar.
        ['--chrome-top' as string]: compact
          ? 'max(8px, env(safe-area-inset-top, 0px))'
          : '54px',
        ['--nav-top' as string]: compact
          ? 'max(10px, env(safe-area-inset-top, 0px))'
          : '64px',
        ['--flow-pad-top' as string]: compact
          ? 'calc(var(--chrome-top) + 44px)'
          : '110px',
        // Mobile: sit CTAs closer to the home edge; desktop keeps mock home-indicator room.
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
        {!compact && keyboard ? <IOSKeyboard dark={dark} /> : null}
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
