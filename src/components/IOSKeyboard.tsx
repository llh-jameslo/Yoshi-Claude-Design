import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  deleteFromFocusedField,
  insertIntoFocusedField,
  pressEnterOnFocusedField,
} from '../lib/fakeKeyboardInput'

type Props = {
  dark?: boolean
}

type KeyOpts = {
  w?: number
  flex?: boolean
  ret?: boolean
  fs?: number
  k: string
  action?: 'char' | 'space' | 'del' | 'ret' | 'shift' | 'noop'
  char?: string
}

type Edge = 'left' | 'right' | 'center'

const PREVIEW_MIN_MS = 90

function KeyPreview({
  label,
  edge,
  dark,
}: {
  label: string
  edge: Edge
  dark: boolean
}) {
  const bg = dark ? '#636366' : '#fff'
  const color = dark ? '#fff' : '#111'
  const shiftX = edge === 'left' ? '0%' : edge === 'right' ? '-100%' : '-50%'
  const left = edge === 'left' ? '0%' : edge === 'right' ? '100%' : '50%'
  const stemAlign =
    edge === 'left' ? 'flex-start' : edge === 'right' ? 'flex-end' : 'center'

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left,
        bottom: 34,
        transform: `translateX(${shiftX})`,
        zIndex: 40,
        pointerEvents: 'none',
        filter: dark
          ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))'
          : 'drop-shadow(0 3px 8px rgba(0,0,0,0.18))',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: stemAlign,
          transformOrigin:
            edge === 'left'
              ? 'bottom left'
              : edge === 'right'
                ? 'bottom right'
                : 'bottom center',
          animation: 'iosKeyPreviewIn 70ms ease-out',
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 10,
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '-apple-system, "SF Compact", system-ui',
            fontSize: 34,
            fontWeight: 400,
            color,
            lineHeight: 1,
          }}
        >
          {label}
        </div>
        {/* Stem that bridges popup → key, biased for edge letters */}
        <div
          style={{
            width: edge === 'center' ? 36 : 48,
            height: 18,
            marginTop: -1,
            background: bg,
            clipPath:
              edge === 'left'
                ? 'polygon(0 0, 100% 0, 72% 100%, 0 100%)'
                : edge === 'right'
                  ? 'polygon(0 0, 100% 0, 100% 100%, 28% 100%)'
                  : 'polygon(8% 0, 92% 0, 100% 100%, 0 100%)',
          }}
        />
      </div>
    </div>
  )
}

function LetterKey({
  char,
  shifted,
  edge,
  dark,
  glyph,
  keyBg,
  onType,
}: {
  char: string
  shifted: boolean
  edge: Edge
  dark: boolean
  glyph: string
  keyBg: string
  onType: (ch: string) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const hideTimer = useRef<number | null>(null)
  const downAt = useRef(0)
  const label = shifted ? char.toUpperCase() : char.toLowerCase()

  useEffect(() => {
    return () => {
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    }
  }, [])

  const hide = () => {
    const elapsed = performance.now() - downAt.current
    const wait = Math.max(0, PREVIEW_MIN_MS - elapsed)
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      setPreview(null)
      hideTimer.current = null
    }, wait)
  }

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        if (hideTimer.current != null) {
          window.clearTimeout(hideTimer.current)
          hideTimer.current = null
        }
        downAt.current = performance.now()
        setPreview(label)
        onType(char)
      }}
      onPointerUp={hide}
      onPointerCancel={hide}
      style={{
        position: 'relative',
        height: 42,
        borderRadius: 8.5,
        flex: 1,
        minWidth: 0,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: preview
          ? dark
            ? 'rgba(255,255,255,0.34)'
            : '#fff'
          : keyBg,
        boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, "SF Compact", system-ui',
        fontSize: 25,
        fontWeight: 458,
        color: glyph,
        zIndex: preview ? 30 : 1,
      }}
    >
      {label}
      {preview ? <KeyPreview label={preview} edge={edge} dark={dark} /> : null}
    </button>
  )
}

export function IOSKeyboard({ dark = false }: Props) {
  const [shifted, setShifted] = useState(false)
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959'
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333'
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)'

  const icons = {
    shift: (
      <svg width="19" height="17" viewBox="0 0 19 17">
        <path d="M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z" fill={glyph} />
      </svg>
    ),
    del: (
      <svg width="23" height="17" viewBox="0 0 23 17">
        <path
          d="M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z"
          fill="none"
          stroke={glyph}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M10 5l7 7M17 5l-7 7"
          stroke={glyph}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
    ret: (
      <svg width="20" height="14" viewBox="0 0 20 14">
        <path
          d="M18 1v6H4m0 0l4-4M4 7l4 4"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  }

  const typeChar = (ch: string) => {
    insertIntoFocusedField(shifted ? ch.toUpperCase() : ch.toLowerCase())
    if (shifted) setShifted(false)
  }

  const runAction = (opts: KeyOpts) => {
    const action = opts.action ?? 'char'
    if (action === 'shift') {
      setShifted((s) => !s)
      return
    }
    if (action === 'noop') return
    if (action === 'del') {
      deleteFromFocusedField()
      return
    }
    if (action === 'ret') {
      pressEnterOnFocusedField()
      return
    }
    if (action === 'space') {
      insertIntoFocusedField(' ')
      return
    }
    const ch = opts.char ?? ''
    if (!ch) return
    typeChar(ch)
  }

  const key = (content: ReactNode, opts: KeyOpts) => (
    <button
      key={opts.k}
      type="button"
      tabIndex={-1}
      aria-label={
        opts.action === 'del'
          ? 'Delete'
          : opts.action === 'ret'
            ? 'Return'
            : opts.action === 'space'
              ? 'Space'
              : opts.action === 'shift'
                ? 'Shift'
                : typeof content === 'string'
                  ? content
                  : opts.k
      }
      onPointerDown={(e) => {
        e.preventDefault()
        runAction(opts)
      }}
      style={{
        height: 42,
        borderRadius: 8.5,
        flex: opts.flex ? 1 : undefined,
        width: opts.w,
        minWidth: 0,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background:
          opts.ret
            ? '#08f'
            : opts.action === 'shift' && shifted
              ? dark
                ? 'rgba(255,255,255,0.4)'
                : '#fff'
              : keyBg,
        boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, "SF Compact", system-ui',
        fontSize: opts.fs ?? 25,
        fontWeight: 458,
        color: opts.ret ? '#fff' : glyph,
      }}
    >
      {content}
    </button>
  )

  const letterRow = (keys: string[], pad = 0) => (
    <div
      style={{
        display: 'flex',
        gap: 6.5,
        justifyContent: 'center',
        padding: `0 ${pad}px`,
      }}
    >
      {keys.map((l, i) => {
        const edge: Edge =
          i === 0 ? 'left' : i === keys.length - 1 ? 'right' : 'center'
        return (
          <LetterKey
            key={l}
            char={l}
            shifted={shifted}
            edge={edge}
            dark={dark}
            glyph={glyph}
            keyBg={keyBg}
            onType={typeChar}
          />
        )
      })}
    </div>
  )

  return (
    <div
      data-ios-keyboard
      onPointerDown={(e) => {
        // Keep the focused field alive for taps on gaps between keys
        e.preventDefault()
      }}
      style={{
        position: 'relative',
        zIndex: 15,
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: '27px 27px 0 0',
        overflow: 'visible',
        padding: '11px 0 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: dark
          ? '0 -2px 20px rgba(0,0,0,0.09)'
          : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)',
      }}
    >
      <style>
        {`@keyframes iosKeyPreviewIn {
          from { opacity: 0; transform: translateY(5px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }`}
      </style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '27px 27px 0 0',
          overflow: 'hidden',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '27px 27px 0 0',
          boxShadow: dark
            ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)'
            : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
          border: dark
            ? '0.5px solid rgba(255,255,255,0.15)'
            : '0.5px solid rgba(0,0,0,0.06)',
          borderBottom: 'none',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          padding: '8px 22px 13px',
          width: '100%',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {['"The"', 'the', 'to'].map((w, i) => (
          <div key={w} style={{ display: 'contents' }}>
            {i > 0 && (
              <div style={{ width: 1, height: 25, background: '#ccc', opacity: 0.3 }} />
            )}
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault()
                insertIntoFocusedField(w.replace(/^"|"$/g, '') + ' ')
              }}
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: '-apple-system, system-ui',
                fontSize: 17,
                color: sugg,
                letterSpacing: -0.43,
                lineHeight: '22px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {w}
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
          padding: '0 6.5px',
          width: '100%',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {letterRow(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'])}
        {letterRow(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20)}
        <div style={{ display: 'flex', gap: 14.25, alignItems: 'center' }}>
          {key(icons.shift, { w: 45, k: 'shift', action: 'shift' })}
          <div style={{ display: 'flex', gap: 6.5, flex: 1 }}>
            {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map((l, i, arr) => {
              const edge: Edge =
                i === 0 ? 'left' : i === arr.length - 1 ? 'right' : 'center'
              return (
                <LetterKey
                  key={l}
                  char={l}
                  shifted={shifted}
                  edge={edge}
                  dark={dark}
                  glyph={glyph}
                  keyBg={keyBg}
                  onType={typeChar}
                />
              )
            })}
          </div>
          {key(icons.del, { w: 45, k: 'del', action: 'del' })}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {key(shifted ? 'abc' : 'ABC', {
            w: 92.25,
            fs: 18,
            k: 'abc',
            action: 'shift',
          })}
          {key('', { flex: true, k: 'space', action: 'space' })}
          {key(icons.ret, { w: 92.25, ret: true, k: 'ret', action: 'ret' })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 34,
          width: '100%',
          position: 'relative',
        }}
      />
    </div>
  )
}
