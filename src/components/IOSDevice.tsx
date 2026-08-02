import type { ReactNode } from 'react'
import { useCompactViewport } from '../hooks/useCompactViewport'
import { IOSStatusBar } from './IOSStatusBar'
import { IOSKeyboard } from './IOSKeyboard'

/** Space layouts reserve below the fake status bar (desktop chrome). */
const FAKE_STATUS_TRIM = 54

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
      style={{
        width: compact ? '100%' : width,
        height: compact ? '100%' : height,
        maxWidth: compact ? '100%' : width,
        maxHeight: compact ? '100%' : height,
        borderRadius: compact ? 0 : 48,
        overflow: 'hidden',
        position: 'relative',
        background: dark ? '#000' : '#F2F2F7',
        boxShadow: compact
          ? 'none'
          : '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
        fontFamily: '-apple-system, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {!compact && (
        <div
          style={{
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
      )}
      {!compact && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <IOSStatusBar dark={dark} />
        </div>
      )}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            paddingTop: compact ? 'env(safe-area-inset-top, 0px)' : 0,
          }}
        >
          <div
            style={
              compact
                ? {
                    position: 'relative',
                    height: `calc(100% + ${FAKE_STATUS_TRIM}px)`,
                    marginTop: -FAKE_STATUS_TRIM,
                  }
                : { height: '100%', position: 'relative' }
            }
          >
            {children}
          </div>
        </div>
        {keyboard && !compact && <IOSKeyboard dark={dark} />}
      </div>
      {!compact && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            height: 34,
            display: 'flex',
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
      )}
    </div>
  )
}
