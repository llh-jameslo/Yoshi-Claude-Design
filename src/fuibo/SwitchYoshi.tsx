import {
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type UIEvent,
} from 'react'
import { useCompactViewport } from '../hooks/useCompactViewport'
import { orderedYoshis, type Yoshi } from './yoshis'

const CARD_W = 300
const GAP = 28
const STRIDE = CARD_W + GAP
/** Match “Switch Yoshi” title inset (left: 24) */
const SIDE_PAD = 24

type CustomYoshi = {
  id: string
  name?: string
  image?: string
}

type Props = {
  selectedId: string
  onBack: () => void
  onSelect: (id: string) => void
  /** Onboarding pick: overrides image/name for that Yoshi slot only */
  customYoshi?: CustomYoshi
}

export function SwitchYoshi({
  selectedId,
  onBack,
  onSelect,
  customYoshi,
}: Props) {
  const compact = useCompactViewport()
  const railRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const dragMoved = useRef(false)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const list = useMemo(() => {
    return orderedYoshis(selectedId).map((y) => {
      if (!customYoshi || y.id !== customYoshi.id) return y
      return {
        ...y,
        name: customYoshi.name?.trim() || y.name,
        image: customYoshi.image || y.image,
      }
    })
  }, [selectedId, customYoshi])

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    // Selected is always first — open at the left edge
    el.scrollLeft = 0
  }, [selectedId])

  useEffect(
    () => () => {
      if (snapTimer.current) clearTimeout(snapTimer.current)
    },
    [],
  )

  const snap = () => {
    const el = railRef.current
    if (!el) return
    el.style.cursor = 'grab'
    const next = Math.max(
      0,
      Math.min(list.length - 1, Math.round(el.scrollLeft / STRIDE)),
    )
    el.scrollTo({ left: next * STRIDE, behavior: 'smooth' })
  }

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const el = railRef.current
    if (!el) return
    drag.current = { x: e.clientX, left: el.scrollLeft }
    dragMoved.current = false
    el.style.cursor = 'grabbing'
  }

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const el = railRef.current
    if (!el) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) dragMoved.current = true
    el.scrollLeft = drag.current.left - dx
  }

  const onMouseUp = () => {
    if (!drag.current) return
    drag.current = null
    snap()
  }

  /** Mobile-only: settle after touch momentum (desktop keeps mouse-up snap only). */
  const onScroll = (_e: UIEvent<HTMLDivElement>) => {
    if (!compact) return
    if (drag.current) return
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => snap(), 120)
  }

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'Geist', -apple-system, sans-serif",
        background: '#F3F1F6',
      }}
    >
      <div
        onClick={onBack}
        style={{
          position: 'absolute',
          top: compact ? 'var(--nav-top, 64px)' : 64,
          left: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 4px 14px rgba(26,24,20,.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 12,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 19,
            height: 2.5,
            background: '#17151C',
            borderRadius: 2,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              width: 9,
              height: 9,
              borderLeft: '2.5px solid #17151C',
              borderBottom: '2.5px solid #17151C',
              transform: 'translateY(-50%) rotate(45deg)',
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: compact ? 'calc(var(--nav-top, 64px) + 68px)' : 132,
          left: 24,
          right: 24,
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: '-.02em',
            color: '#17151C',
          }}
        >
          Switch
          <br />
          Yoshi
        </div>
      </div>

      <div
        ref={railRef}
        className="fuibo-scroll topic-rail"
        onScroll={onScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          position: 'absolute',
          // Desktop: a bit more air under the title than the original 262
          top: compact ? 'calc(var(--nav-top, 64px) + 198px)' : 284,
          left: 0,
          right: 0,
          bottom: 34,
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: GAP,
          // Desktop: unchanged. Mobile: set sides separately so a bad right calc
          // can't wipe left inset; scroll-padding keeps snap off the screen edge.
          ...(compact
            ? {
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: SIDE_PAD,
                paddingRight: `max(${SIDE_PAD}px, calc(100% - ${CARD_W}px - ${SIDE_PAD}px))`,
                scrollPaddingLeft: SIDE_PAD,
              }
            : {
                padding: `0 calc((100% - ${CARD_W}px) / 2) 0 ${SIDE_PAD}px`,
              }),
          cursor: 'grab',
          userSelect: 'none',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          ...(compact
            ? {
                scrollSnapType: 'x mandatory' as const,
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorX: 'contain' as const,
                touchAction: 'pan-x' as const,
              }
            : {}),
        }}
      >
        {list.map((y) => (
          <YoshiCard
            key={y.id}
            yoshi={y}
            selected={y.id === selectedId}
            snapAlign={compact}
            onSelect={() => {
              if (dragMoved.current) {
                dragMoved.current = false
                return
              }
              onSelect(y.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function YoshiCard({
  yoshi,
  selected,
  onSelect,
  snapAlign = false,
}: {
  yoshi: Yoshi
  selected: boolean
  onSelect: () => void
  snapAlign?: boolean
}) {
  // Character image is the tall layer; accent plate is a separate sibling
  // behind it at ~75% of the image height (not a wrapping parent).
  const NAME_H = 56
  const NAME_GAP = 14 // space between image bottom and name bubble
  const SIDE_INSET = 16
  const PAD_BOTTOM = 12
  const FOOTER_H = NAME_H + NAME_GAP + PAD_BOTTOM
  const IMG_SIDE = SIDE_INSET

  return (
    <div
      style={{
        flex: 'none',
        width: CARD_W,
        height: '100%',
        maxHeight: 500,
        position: 'relative',
        ...(snapAlign
          ? {
              scrollSnapAlign: 'start' as const,
              scrollSnapStop: 'always' as const,
            }
          : {}),
      }}
    >
      {/* Background card — shorter plate under the character */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          // 75% of character-card height + footer band (gap + name + pad)
          height: `calc((100% - ${FOOTER_H}px) * 0.75 + ${FOOTER_H}px)`,
          background: yoshi.accent,
          borderRadius: 28,
          zIndex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          padding: `${PAD_BOTTOM}px ${SIDE_INSET}px`,
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={selected ? `${yoshi.name} selected` : `Select ${yoshi.name}`}
          style={{
            width: '100%',
            height: NAME_H,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px 0 16px',
            boxSizing: 'border-box',
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 500,
              color: '#17151C',
              letterSpacing: '-.01em',
            }}
          >
            {yoshi.name}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: selected ? '#B8B4BE' : '#1A1814',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            {selected ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M4 9.2l3.2 3.2L14 5.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M4 9h9.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M10 5.5L13.5 9 10 12.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </button>
      </div>

      {/* Character card — sibling overlay, not nested in the accent plate */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: IMG_SIDE,
          right: IMG_SIDE,
          height: `calc(100% - ${FOOTER_H}px)`,
          borderRadius: 22,
          overflow: 'hidden',
          zIndex: 2,
          pointerEvents: 'none',
          boxShadow: '0 10px 28px rgba(26,24,20,.12)',
        }}
      >
        <img
          src={yoshi.image}
          alt={yoshi.name}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 18%',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}
