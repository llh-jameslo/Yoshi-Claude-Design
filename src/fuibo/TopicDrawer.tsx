import { useRef, type MouseEvent, type UIEvent } from 'react'

const STRIDE = 330
const CARD_W = 316
const CARD_H = 168
const SNAP = 'x mandatory'

const CARDS = [
  {
    eyebrow: 'Found for you',
    title: 'There’s a dog show nearby this weekend',
    cta: 'Check it out',
    tone: 'lilac' as const,
  },
  {
    eyebrow: 'Checking in',
    title: 'How did that 1:1 with your manager go?',
    cta: 'Tell me',
    tone: 'peach' as const,
  },
  {
    eyebrow: 'For later',
    title: 'Found a quiet show we can watch together',
    cta: 'Show me',
    tone: 'mint' as const,
  },
] as const

const TONES: Record<
  (typeof CARDS)[number]['tone'],
  { bg: string; blobA: string; blobB: string; ink: string }
> = {
  lilac: {
    bg: 'linear-gradient(145deg, #F4F0FA 0%, #EDE7F7 48%, #F7F2EA 100%)',
    blobA: 'rgba(168, 152, 207, 0.35)',
    blobB: 'rgba(192, 90, 60, 0.16)',
    ink: '#1A2756',
  },
  peach: {
    bg: 'linear-gradient(145deg, #FBF1EA 0%, #F6E4D8 45%, #F3EAF4 100%)',
    blobA: 'rgba(224, 140, 110, 0.32)',
    blobB: 'rgba(168, 152, 207, 0.22)',
    ink: '#2A2620',
  },
  mint: {
    bg: 'linear-gradient(145deg, #EEF6F2 0%, #E7F0EA 50%, #F4F0FA 100%)',
    blobA: 'rgba(120, 170, 150, 0.28)',
    blobB: 'rgba(192, 90, 60, 0.14)',
    ink: '#1A2756',
  },
}

type Props = {
  idx: number
  onIdxChange: (idx: number) => void
  onTapCard: (i: number) => void
  onClose: () => void
  getDragMoved: () => boolean
  setDragMoved: (v: boolean) => void
}

export function TopicDrawer({
  idx,
  onIdxChange,
  onTapCard,
  onClose,
  getDragMoved,
  setDragMoved,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)

  const snap = () => {
    const el = railRef.current
    if (!el) return
    el.style.cursor = 'grab'
    el.style.scrollSnapType = SNAP
    const next = Math.max(0, Math.min(2, Math.round(el.scrollLeft / STRIDE)))
    el.scrollTo({ left: next * STRIDE, behavior: 'smooth' })
  }

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const next = Math.max(
      0,
      Math.min(2, Math.round(e.currentTarget.scrollLeft / STRIDE)),
    )
    if (next !== idx) onIdxChange(next)
  }

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const el = railRef.current
    if (!el) return
    // Desktop drag: disable snap so scrubbing stays continuous until release
    el.style.scrollSnapType = 'none'
    drag.current = { x: e.clientX, left: el.scrollLeft }
    setDragMoved(false)
    el.style.cursor = 'grabbing'
  }

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const el = railRef.current
    if (!el) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) setDragMoved(true)
    el.scrollLeft = drag.current.left - dx
  }

  const onMouseUp = () => {
    if (!drag.current) return
    drag.current = null
    snap()
  }

  // Native touch scroll on iOS doesn't fire mouse handlers — CSS snap covers it.
  const onTouchStart = () => {
    const el = railRef.current
    if (!el) return
    el.style.scrollSnapType = SNAP
    setDragMoved(false)
  }

  const onTouchMove = () => {
    setDragMoved(true)
  }

  const dots = [0, 1, 2].map((i) => (
    <div
      key={i}
      style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        border: '1.5px solid #fff',
        background: idx === i ? '#fff' : 'transparent',
        boxSizing: 'border-box',
      }}
    />
  ))

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(var(--nav-top, 64px) + 72px)',
        left: 0,
        right: 0,
        zIndex: 25,
        animation: 'fuiboDropIn .32s ease',
      }}
    >
      <div
        ref={railRef}
        className="fuibo-scroll topic-rail"
        onScroll={onScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        style={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: 14,
          padding: '6px calc(50% - 158px) 14px',
          cursor: 'grab',
          userSelect: 'none',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: SNAP,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {CARDS.map((card, i) => (
          <div
            key={card.title}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (getDragMoved()) {
                setDragMoved(false)
                return
              }
              onTapCard(i)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onTapCard(i)
              }
            }}
            style={{
              flex: 'none',
              width: CARD_W,
              height: CARD_H,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              font: 'inherit',
              textAlign: 'left',
              scrollSnapAlign: 'center',
              scrollSnapStop: 'always',
              position: 'relative',
            }}
          >
            <TopicCard {...card} onClose={onClose} />
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 9,
          paddingTop: 4,
        }}
      >
        {dots}
      </div>
    </div>
  )
}

function TopicCard({
  eyebrow,
  title,
  cta,
  tone,
  onClose,
}: (typeof CARDS)[number] & { onClose: () => void }) {
  const t = TONES[tone]

  return (
    <div
      style={{
        position: 'relative',
        width: CARD_W,
        height: CARD_H,
        borderRadius: 16,
        overflow: 'hidden',
        background: t.bg,
        boxShadow: '0 12px 28px rgba(20,17,26,0.22)',
        fontFamily: "'Geist', -apple-system, sans-serif",
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: t.blobA,
          filter: 'blur(2px)',
          top: -36,
          right: -28,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: t.blobB,
          bottom: -40,
          left: -20,
        }}
      />

      <button
        type="button"
        aria-label="Close topics"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 3,
          width: 24,
          height: 24,
          border: 'none',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'rgba(26, 39, 86, 0.38)',
          cursor: 'pointer',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2.5 2.5l7 7M9.5 2.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          padding: '18px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: t.ink,
            opacity: 0.55,
            paddingRight: 28,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
          <span
            aria-hidden
            style={{
              width: 28,
              height: 1,
              background: 'currentColor',
              opacity: 0.7,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            color: t.ink,
            maxWidth: 246,
          }}
        >
          {title}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 34,
              padding: '0 14px',
              borderRadius: 999,
              background: '#17151C',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {cta}
          </span>
        </div>
      </div>
    </div>
  )
}
