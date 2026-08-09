import {
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type UIEvent,
} from 'react'
import { useCompactViewport } from '../hooks/useCompactViewport'
import type { Yoshi } from './yoshis'

const CARD_W = 300
const GAP = 28
const STRIDE = CARD_W + GAP
/** Match “Switch Yoshi” title inset (left: 24) */
const SIDE_PAD = 24

type Props = {
  yoshis: Yoshi[]
  selectedId: string
  /** How many empty “Add Yoshi” cards to show after owned ones */
  emptySlots?: number
  onBack: () => void
  onSelect: (id: string) => void
  /** Start creating another Yoshi */
  onAddYoshi?: () => void
}

export function SwitchYoshi({
  yoshis,
  selectedId,
  emptySlots = 0,
  onBack,
  onSelect,
  onAddYoshi,
}: Props) {
  const compact = useCompactViewport()
  const railRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const dragMoved = useRef(false)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selected first, then the rest of the user’s Yoshis
  const list = useMemo(() => {
    const selected = yoshis.find((y) => y.id === selectedId)
    const rest = yoshis.filter((y) => y.id !== selectedId)
    return selected ? [selected, ...rest] : yoshis
  }, [yoshis, selectedId])

  const railLen = list.length + emptySlots

  useEffect(() => {
    const el = railRef.current
    if (!el) return
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
      Math.min(Math.max(0, railLen - 1), Math.round(el.scrollLeft / STRIDE)),
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

  const tryAdd = () => {
    if (dragMoved.current) {
      dragMoved.current = false
      return
    }
    onAddYoshi?.()
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
        {Array.from({ length: emptySlots }, (_, slot) => (
          <AddYoshiCard
            key={`add-yoshi-${slot}`}
            snapAlign={compact}
            onAdd={tryAdd}
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
  const NAME_H = 56
  const NAME_GAP = 14
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
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
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

function AddYoshiCard({
  onAdd,
  snapAlign = false,
}: {
  onAdd: () => void
  snapAlign?: boolean
}) {
  const NAME_H = 56
  const NAME_GAP = 14
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
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `calc((100% - ${FOOTER_H}px) * 0.75 + ${FOOTER_H}px)`,
          background: '#E4E0EC',
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
            onAdd()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Add another Yoshi"
          style={{
            width: '100%',
            height: NAME_H,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.55)',
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
            Add Yoshi
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#1A1814',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1,
              paddingBottom: 2,
            }}
          >
            +
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onAdd()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Create a new Yoshi"
        style={{
          position: 'absolute',
          top: 0,
          left: IMG_SIDE,
          right: IMG_SIDE,
          height: `calc(100% - ${FOOTER_H}px)`,
          borderRadius: 22,
          zIndex: 2,
          border: '1.5px dashed rgba(26,24,20,0.22)',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.28) 100%)',
          boxShadow: '0 10px 28px rgba(26,24,20,.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          cursor: 'pointer',
          padding: 0,
          font: 'inherit',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 8px 20px rgba(26,24,20,.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#17151C',
            fontSize: 40,
            fontWeight: 300,
            lineHeight: 1,
            paddingBottom: 3,
          }}
        >
          +
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'rgba(23,21,28,0.55)',
            letterSpacing: '-.01em',
          }}
        >
          Create another
        </span>
      </button>
    </div>
  )
}
