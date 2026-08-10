import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  formatMemoryStamp,
  newBlockId,
  type Memory,
  type MemoryBlock,
  type MemoryBlockKind,
} from './memories'
import type { OwnedYoshi } from './ownedYoshis'
import { VoiceNote, type VoiceClip } from './VoiceNote'

export const SHEET_MS = 420
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const CARD_ORDER: MemoryBlockKind[] = [
  'location',
  'memo',
  'photos',
  'voice',
  'mood',
]

const CARD_META: Record<
  MemoryBlockKind,
  { icon: string; prompt: string; tint: string }
> = {
  location: { icon: '🗺️', prompt: 'Where were you?', tint: '#FFFFFF' },
  memo: { icon: '📝', prompt: 'Good to Know', tint: '#FBE983' },
  photos: { icon: '🖼️', prompt: 'What did it look like?', tint: '#FFFFFF' },
  voice: { icon: '🎙️', prompt: 'Say it out loud', tint: '#FFFFFF' },
  mood: { icon: '💛', prompt: 'How did it feel?', tint: '#FFFFFF' },
}

const MOODS: [string, string][] = [
  ['🥹', 'tender'],
  ['😄', 'happy'],
  ['😌', 'calm'],
  ['🔥', 'alive'],
  ['🫠', 'soft'],
  ['😭', 'a lot'],
]

function emptyBlock(kind: MemoryBlockKind): MemoryBlock {
  const id = newBlockId(kind)
  if (kind === 'memo') return { kind, id, text: '' }
  if (kind === 'location') return { kind, id, label: '' }
  if (kind === 'photos') return { kind, id, urls: [] }
  if (kind === 'voice') return { kind, id, url: '', seconds: 0, peaks: [] }
  return { kind, id, emoji: '', label: '' }
}

/** Local-time value for <input type="datetime-local">. */
function toLocalInput(at: number) {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

function revokeBlockUrls(blocks: MemoryBlock[]) {
  blocks.forEach((b) => {
    if (b.kind === 'photos') b.urls.forEach((u) => URL.revokeObjectURL(u))
    if (b.kind === 'voice' && b.url) URL.revokeObjectURL(b.url)
  })
}

type Props = {
  open: boolean
  memory: Memory | null
  mode: 'compose' | 'view'
  yoshis: OwnedYoshi[]
  onClose: () => void
  onSave: (memory: Memory) => void
  onDelete: (id: string) => void
}

export function MemorySheet({
  open,
  memory,
  mode,
  yoshis,
  onClose,
  onSave,
}: Props) {
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)
  const [draft, setDraft] = useState<Memory | null>(memory)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (memory) setDraft(memory)
  }, [memory])

  useEffect(() => {
    if (open) {
      setRender(true)
      setDrag(0)
      const id = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = window.setTimeout(() => setRender(false), SHEET_MS)
    return () => window.clearTimeout(t)
  }, [open])

  const startY = useRef(0)
  const canDrag = useRef(false)

  const onGrabDown = (e: ReactPointerEvent) => {
    canDrag.current = true
    startY.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onGrabMove = (e: ReactPointerEvent) => {
    if (!canDrag.current) return
    setDrag(Math.max(0, e.clientY - startY.current))
  }
  const onGrabUp = () => {
    if (!canDrag.current) return
    canDrag.current = false
    setDragging(false)
    if (drag > 120) dismiss()
    else setDrag(0)
  }

  if (!render || !draft) return null

  const patch = (next: Partial<Memory>) => setDraft({ ...draft, ...next })

  const setBlock = (id: string, next: MemoryBlock) =>
    patch({ blocks: draft.blocks.map((b) => (b.id === id ? next : b)) })

  const addBlock = (kind: MemoryBlockKind) =>
    patch({ blocks: [...draft.blocks, emptyBlock(kind)] })

  const removeBlock = (id: string) => {
    const gone = draft.blocks.find((b) => b.id === id)
    if (gone) revokeBlockUrls([gone])
    patch({ blocks: draft.blocks.filter((b) => b.id !== id) })
  }

  function dismiss() {
    // A memory that was never planted takes its attachments with it
    if (mode === 'compose' && draft) revokeBlockUrls(draft.blocks)
    onClose()
  }

  const authorInfo = draft.author
  const author =
    authorInfo.kind === 'yoshi'
      ? yoshis.find((y) => y.id === authorInfo.yoshiId)
      : undefined

  const hasContent =
    draft.title.trim().length > 0 ||
    draft.body.trim().length > 0 ||
    draft.blocks.length > 0

  const missing = CARD_ORDER.filter(
    (kind) => !draft.blocks.some((b) => b.kind === kind),
  )
  const cards: ReactNode[] = []

  draft.blocks.forEach((block) => {
    cards.push(
      <FilledCard
        key={block.id}
        block={block}
        onChange={(next) => setBlock(block.id, next)}
        onRemove={() => removeBlock(block.id)}
      />,
    )
  })
  missing.forEach((kind) => {
    cards.push(
      <AddCard key={kind} kind={kind} onAdd={() => addBlock(kind)} />,
    )
  })

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        // Under the device status bar (10) so the clock stays visible
        zIndex: 9,
        pointerEvents: shown ? 'auto' : 'none',
      }}
    >
      <div
        onClick={dismiss}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20,17,26,0.28)',
          opacity: shown ? Math.max(0, 1 - drag / 320) : 0,
          transition: dragging ? 'none' : `opacity ${SHEET_MS}ms ${SHEET_EASE}`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: '26px 26px 0 0',
          overflow: 'hidden',
          background:
            'radial-gradient(90% 55% at 6% 0%, #EDF3FF 0%, rgba(237,243,255,0) 58%), radial-gradient(85% 55% at 100% 100%, #E9F7EE 0%, rgba(233,247,238,0) 55%), #FFFFFF',
          boxShadow: '0 -14px 44px rgba(20,17,26,0.18)',
          transform: shown ? `translateY(${drag}px)` : 'translateY(100%)',
          transition: dragging
            ? 'none'
            : `transform ${SHEET_MS}ms ${SHEET_EASE}`,
          willChange: 'transform',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            paddingTop: 'var(--nav-top, 56px)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 20px 0',
            }}
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              style={circleBtn}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>✕</span>
            </button>
          </div>
          <div
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabUp}
            onPointerCancel={onGrabUp}
            aria-hidden
            style={{
              height: 18,
              touchAction: 'none',
              cursor: 'grab',
            }}
          />
        </div>

        <div
          className="fuibo-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 24px 120px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <AutoTextarea
            value={draft.title}
            onChange={(title) => patch({ title })}
            placeholder="Name this memory"
            style={{
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.14,
              letterSpacing: '-.02em',
              color: '#17151C',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              margin: '10px 0 4px',
            }}
          >
            <label style={stampChip}>
              {formatMemoryStamp(draft.at)}
              <input
                type="datetime-local"
                value={toLocalInput(draft.at)}
                onChange={(e) => {
                  const next = new Date(e.target.value).getTime()
                  if (!Number.isNaN(next)) patch({ at: next })
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              />
            </label>
            {author ? (
              <span style={{ ...stampChip, gap: 7, paddingLeft: 5 }}>
                <img
                  src={author.image}
                  alt=""
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
                {author.name} wrote this
              </span>
            ) : null}
          </div>

          <AutoTextarea
            value={draft.body}
            onChange={(body) => patch({ body })}
            placeholder="What happened?"
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: '#6F6B7A',
              marginTop: 6,
            }}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 26,
            }}
          >
            {cards.map((card, i) => (
              <div
                key={i}
                style={{
                  width: '82%',
                  alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
                  marginTop: i === 0 ? 0 : -20,
                  transform: `rotate(${i % 2 === 0 ? -0.7 : 0.7}deg)`,
                  zIndex: i + 1,
                }}
              >
                {card}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            right: 24,
            bottom: 'calc(26px + var(--safe-bottom, 0px))',
            zIndex: 2,
          }}
        >
          <button
            type="button"
            disabled={!hasContent}
            onClick={() => onSave(draft)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '15px 26px',
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              background: hasContent ? '#2F80F5' : 'rgba(47,128,245,0.4)',
              boxShadow: hasContent
                ? '0 10px 24px rgba(47,128,245,0.34)'
                : 'none',
              cursor: hasContent ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            {mode === 'compose' ? 'Plant it' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      style={{
        width: '100%',
        border: 'none',
        outline: 'none',
        resize: 'none',
        background: 'transparent',
        padding: 0,
        fontFamily: 'inherit',
        overflow: 'hidden',
        display: 'block',
        ...style,
      }}
    />
  )
}

function AddCard({
  kind,
  onAdd,
}: {
  kind: MemoryBlockKind
  onAdd: () => void
}) {
  const meta = CARD_META[kind]
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 168,
        border: '1.6px dashed #D6D3E0',
        borderRadius: 22,
        background: 'rgba(255,255,255,0.55)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: 18,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 12,
          right: 16,
          fontSize: 20,
          color: '#B9B6C4',
          lineHeight: 1,
        }}
      >
        +
      </span>
      <span
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          background: '#fff',
          boxShadow: '0 4px 12px rgba(20,17,26,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}
      >
        {meta.icon}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#17151C' }}>
        {meta.prompt}
      </span>
    </button>
  )
}

function CardShell({
  tint,
  onRemove,
  children,
}: {
  tint: string
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 22,
        background: tint,
        boxShadow: '0 8px 26px rgba(20,17,26,0.10)',
        // Extra room at the foot so the next card's overlap never eats content
        padding: '18px 18px 34px',
      }}
    >
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove card"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(23,21,28,0.07)',
          color: '#5A5666',
          fontSize: 14,
          lineHeight: 1,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: 0,
        }}
      >
        ✕
      </button>
      {children}
    </div>
  )
}

function FilledCard({
  block,
  onChange,
  onRemove,
}: {
  block: MemoryBlock
  onChange: (next: MemoryBlock) => void
  onRemove: () => void
}) {
  const meta = CARD_META[block.kind]

  return (
    <CardShell tint={meta.tint} onRemove={onRemove}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: block.kind === 'memo' ? '#8A7A1E' : '#A9A5B5',
          marginBottom: 10,
        }}
      >
        {meta.prompt}
      </div>

      {block.kind === 'memo' ? (
        <AutoTextarea
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="Anything worth remembering…"
          style={{ fontSize: 14, lineHeight: 1.7, color: '#3B3520' }}
        />
      ) : null}

      {block.kind === 'location' ? (
        <LocationCard block={block} onChange={onChange} />
      ) : null}

      {block.kind === 'photos' ? (
        <PhotosCard block={block} onChange={onChange} />
      ) : null}

      {block.kind === 'voice' ? (
        <VoiceNote
          clip={block.url ? { url: block.url, seconds: block.seconds, peaks: block.peaks } : null}
          onChange={(clip: VoiceClip) =>
            onChange({
              ...block,
              url: clip.url,
              seconds: clip.seconds,
              peaks: clip.peaks,
            })
          }
        />
      ) : null}

      {block.kind === 'mood' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MOODS.map(([emoji, label]) => {
            const on = block.emoji === emoji
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onChange({ ...block, emoji, label })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: on ? '1.5px solid #17151C' : '1.5px solid #EAE8F0',
                  background: on ? '#17151C' : '#fff',
                  color: on ? '#fff' : '#6F6B7A',
                  borderRadius: 999,
                  padding: '7px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 15 }}>{emoji}</span>
                {label}
              </button>
            )
          })}
        </div>
      ) : null}
    </CardShell>
  )
}

function LocationCard({
  block,
  onChange,
}: {
  block: Extract<MemoryBlock, { kind: 'location' }>
  onChange: (next: MemoryBlock) => void
}) {
  const [locating, setLocating] = useState(false)
  const [failed, setFailed] = useState(false)

  const locate = () => {
    if (!navigator.geolocation) {
      setFailed(true)
      return
    }
    setLocating(true)
    setFailed(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onChange({
          ...block,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        })
      },
      () => {
        setLocating(false)
        setFailed(true)
      },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  const hasPin = block.lat !== undefined && block.lon !== undefined

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {hasPin ? (
        <MapThumb lat={block.lat as number} lon={block.lon as number} />
      ) : (
        <button
          type="button"
          onClick={locate}
          style={{
            border: 'none',
            borderRadius: 999,
            background: 'rgba(23,21,28,0.06)',
            padding: '11px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: '#17151C',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {locating ? 'Finding you…' : 'Use my location'}
        </button>
      )}
      <input
        value={block.label}
        onChange={(e) => onChange({ ...block, label: e.target.value })}
        placeholder={failed ? 'Type where you were' : 'Give this place a name'}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 15,
          fontWeight: 600,
          color: '#17151C',
          fontFamily: 'inherit',
          padding: 0,
        }}
      />
    </div>
  )
}

const TILE_ZOOM = 14

function MapThumb({ lat, lon }: { lat: number; lon: number }) {
  const n = Math.pow(2, TILE_ZOOM)
  const fx = ((lon + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const fy =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const x = Math.floor(fx)
  const y = Math.floor(fy)

  return (
    <div
      style={{
        position: 'relative',
        height: 116,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#E9E6F2',
      }}
    >
      <img
        src={`https://tile.openstreetmap.org/${TILE_ZOOM}/${x}/${y}.png`}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${(fx - x) * 100}%`,
          top: `${(fy - y) * 100}%`,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          borderRadius: '50%',
          background: '#E2574C',
          border: '2.5px solid #fff',
          boxShadow: '0 2px 6px rgba(20,17,26,0.3)',
        }}
      />
    </div>
  )
}

function PhotosCard({
  block,
  onChange,
}: {
  block: Extract<MemoryBlock, { kind: 'photos' }>
  onChange: (next: MemoryBlock) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {block.urls.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
          }}
        >
          {block.urls.map((url) => (
            <div
              key={url}
              style={{
                position: 'relative',
                paddingTop: '100%',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#EFEDF5',
              }}
            >
              <img
                src={url}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => {
                  URL.revokeObjectURL(url)
                  onChange({
                    ...block,
                    urls: block.urls.filter((u) => u !== url),
                  })
                }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(20,17,26,0.6)',
                  color: '#fff',
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          border: 'none',
          borderRadius: 999,
          background: 'rgba(23,21,28,0.06)',
          padding: '11px 16px',
          fontSize: 14,
          fontWeight: 600,
          color: '#17151C',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {block.urls.length ? 'Add more' : 'Choose photos'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? [])
          if (files.length) {
            onChange({
              ...block,
              urls: [...block.urls, ...files.map((f) => URL.createObjectURL(f))],
            })
          }
          e.currentTarget.value = ''
        }}
        style={{ display: 'none' }}
      />
    </div>
  )
}

const circleBtn: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(23,21,28,0.07)',
  color: '#4A4655',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
}

const stampChip: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  background: 'rgba(23,21,28,0.05)',
  padding: '6px 12px',
  fontSize: 12.5,
  fontWeight: 500,
  color: '#7B7786',
  cursor: 'pointer',
}
