import { useRef, type MouseEvent, type UIEvent } from 'react'

const STRIDE = 330

const CARDS = [
  { src: '/image-mrplat2o-7q3w.png', alt: 'Found for you' },
  { src: '/assets/topic-1.png', alt: 'Feature roadmap' },
  { src: '/assets/topic-3.png', alt: 'Follow up' },
] as const

type Props = {
  idx: number
  onIdxChange: (idx: number) => void
  onTapCard: (i: number) => void
  getDragMoved: () => boolean
  setDragMoved: (v: boolean) => void
}

export function TopicDrawer({
  idx,
  onIdxChange,
  onTapCard,
  getDragMoved,
  setDragMoved,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)

  const snap = () => {
    const el = railRef.current
    if (!el) return
    el.style.cursor = 'grab'
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
        top: 136,
        left: 0,
        right: 0,
        zIndex: 25,
        animation: 'fuiboDropIn .32s ease',
      }}
    >
      <div
        ref={railRef}
        className="fuibo-scroll"
        onScroll={onScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: 14,
          padding: '6px calc(50% - 158px) 14px',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {CARDS.map((card, i) => (
          <div
            key={card.src}
            onClick={() => {
              if (getDragMoved()) {
                setDragMoved(false)
                return
              }
              onTapCard(i)
            }}
            style={{ flex: 'none', width: 316 }}
          >
            <img
              src={card.src}
              draggable={false}
              style={{
                width: 316,
                borderRadius: 16,
                display: 'block',
                pointerEvents: 'none',
              }}
              alt={card.alt}
            />
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
