import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { KB_ANIM_MS } from '../components/IOSDevice'
import { useCompactViewport } from '../hooks/useCompactViewport'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import {
  formatMemoryStamp,
  newBlockId,
  yoshiHelpDraft,
  type Memory,
  type MemoryBlock,
  type MemoryBlockKind,
} from './memories'
import type { OwnedYoshi } from './ownedYoshis'
import { VoiceNote, type VoiceClip } from './VoiceNote'

export const SHEET_MS = 420
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** Keep the focused memory card visible above the keyboard / Done footer. */
function scrollCardAboveKeyboard(card: HTMLElement) {
  const scroller = card.closest('.fuibo-scroll') as HTMLElement | null
  if (!scroller) {
    card.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }
  const sRect = scroller.getBoundingClientRect()
  const cRect = card.getBoundingClientRect()
  // Park the card near the upper third of the visible scrollport
  const desiredTop = sRect.top + Math.min(72, sRect.height * 0.14)
  const delta = cRect.top - desiredTop
  if (Math.abs(delta) > 6) {
    scroller.scrollBy({ top: delta, behavior: 'smooth' })
  }
}

const CARD_ORDER: MemoryBlockKind[] = [
  // location + mood hidden for now
  'photos',
  'memo',
  'voice',
]

function MemoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      {/* Soft shadow under the sticky */}
      <rect x="7.5" y="6.5" width="18" height="20" rx="2.5" fill="#E8D48A" />
      {/* Yellow sticky note */}
      <rect x="6" y="5" width="18" height="20" rx="2.5" fill="#FBE983" />
      {/* Folded corner */}
      <path d="M20 5h4v4c0-2.2-1.8-4-4-4Z" fill="#F3D96A" />
      <path d="M20 5v4h4L20 5Z" fill="#E8C84E" />
      {/* Ruled lines */}
      <rect x="9.5" y="11" width="11" height="1.5" rx="0.75" fill="#D4B84A" />
      <rect x="9.5" y="15" width="11" height="1.5" rx="0.75" fill="#D4B84A" />
      <rect x="9.5" y="19" width="7.5" height="1.5" rx="0.75" fill="#D4B84A" />
    </svg>
  )
}

const CARD_META: Record<
  MemoryBlockKind,
  { icon: ReactNode; prompt: string; tint: string }
> = {
  location: { icon: '🗺️', prompt: 'Where were you?', tint: '#FFFFFF' },
  memo: { icon: <MemoIcon />, prompt: 'Write more', tint: '#FBE983' },
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

function blockHasContent(block: MemoryBlock | undefined): boolean {
  if (!block) return false
  if (block.kind === 'memo') return block.text.trim().length > 0
  if (block.kind === 'voice') return Boolean(block.url)
  if (block.kind === 'photos') return block.urls.length > 0
  if (block.kind === 'location')
    return Boolean(block.label.trim() || (block.lat != null && block.lon != null))
  if (block.kind === 'mood') return Boolean(block.emoji)
  return false
}

/** Contentful cards float above empties; relative order within each group stays CARD_ORDER. */
function orderByContent(blocks: MemoryBlock[]): MemoryBlockKind[] {
  const has = (kind: MemoryBlockKind) =>
    blockHasContent(blocks.find((b) => b.kind === kind))
  return [
    ...CARD_ORDER.filter((k) => has(k)),
    ...CARD_ORDER.filter((k) => !has(k)),
  ]
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
  userName?: string
  /** Slide away but keep the draft so Plant memory can reopen it. */
  onHide: (draft: Memory) => void
  /** Close (✕) — wipe the compose draft and start fresh next time. */
  onDiscard: () => void
  onSave: (memory: Memory) => void
  onDelete: (id: string) => void
}

export function MemorySheet({
  open,
  memory,
  mode,
  yoshis,
  userName = '',
  onHide,
  onDiscard,
  onSave,
}: Props) {
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)
  const [draft, setDraft] = useState<Memory | null>(memory)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [helpOfferVisible, setHelpOfferVisible] = useState(false)
  const [helpOfferExpanded, setHelpOfferExpanded] = useState(false)
  const [activityGen, setActivityGen] = useState(0)
  /** Visual collage order — frozen while a card is being edited. */
  const [stackOrder, setStackOrder] = useState<MemoryBlockKind[]>(() =>
    orderByContent(memory?.blocks ?? []),
  )
  const [editingKind, setEditingKind] = useState<MemoryBlockKind | null>(null)
  const compact = useCompactViewport()
  const keyboardInset = useKeyboardInset()

  useEffect(() => {
    if (memory) {
      setDraft(memory)
      setStackOrder(orderByContent(memory.blocks))
      setEditingKind(null)
    }
  }, [memory])

  // After keyboard opens (desktop fake KB or mobile inset), lift the editing card into view
  useEffect(() => {
    if (editingKind !== 'memo' && editingKind !== 'voice') return
    const delay = compact
      ? keyboardInset > 0
        ? 80
        : 280
      : KB_ANIM_MS + 48
    const t = window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(
        `[data-memory-card][data-kind="${editingKind}"]`,
      )
      if (card) scrollCardAboveKeyboard(card)
    }, delay)
    return () => window.clearTimeout(t)
  }, [editingKind, compact, keyboardInset])

  useEffect(() => {
    if (open) {
      setRender(true)
      setDrag(0)
      setShown(false)
      setEditingKind(null)
      if (memory) setStackOrder(orderByContent(memory.blocks))
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }
    setShown(false)
    const t = window.setTimeout(() => setRender(false), SHEET_MS)
    return () => window.clearTimeout(t)
  }, [open])

  const startY = useRef(0)
  const dragY = useRef(0)
  const canDrag = useRef(false)

  const hide = () => {
    if (!draft) return
    onHide(draft)
  }

  const discard = () => {
    if (mode === 'compose' && draft) revokeBlockUrls(draft.blocks)
    onDiscard()
  }

  const onGrabDown = (e: ReactPointerEvent) => {
    if ((e.target as Element | null)?.closest?.('button')) return
    canDrag.current = true
    startY.current = e.clientY
    dragY.current = 0
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onGrabMove = (e: ReactPointerEvent) => {
    if (!canDrag.current) return
    const next = Math.max(0, e.clientY - startY.current)
    dragY.current = next
    setDrag(next)
  }
  const onGrabUp = () => {
    if (!canDrag.current) return
    canDrag.current = false
    setDragging(false)
    if (dragY.current > 120) hide()
    else {
      dragY.current = 0
      setDrag(0)
    }
  }

  const helperYoshi =
    (draft &&
      (yoshis.find((y) => draft.withYoshiIds.includes(y.id)) ?? yoshis[0])) ||
    undefined

  const writingBlank = Boolean(
    draft &&
      mode === 'compose' &&
      draft.title.trim().length === 0 &&
      draft.body.trim().length === 0,
  )

  const noteActivity = () => {
    setActivityGen((n) => n + 1)
    setHelpOfferVisible(false)
    setHelpOfferExpanded(false)
  }

  // After 3s idle on a blank compose sheet: icon pops in, then expands the label
  useEffect(() => {
    if (!open || !writingBlank || !helperYoshi) {
      setHelpOfferVisible(false)
      setHelpOfferExpanded(false)
      return
    }
    setHelpOfferVisible(false)
    setHelpOfferExpanded(false)
    const showIcon = window.setTimeout(() => setHelpOfferVisible(true), 2400)
    const expand = window.setTimeout(() => setHelpOfferExpanded(true), 2820)
    return () => {
      window.clearTimeout(showIcon)
      window.clearTimeout(expand)
    }
  }, [open, writingBlank, helperYoshi, activityGen])

  if (!render || !draft) return null

  const patch = (next: Partial<Memory>) => {
    if ('title' in next || 'body' in next) noteActivity()
    setDraft({ ...draft, ...next })
  }

  const commitBlocks = (nextBlocks: MemoryBlock[]) => {
    setDraft({ ...draft, blocks: nextBlocks })
    setEditingKind(null)
    setStackOrder(orderByContent(nextBlocks))
  }

  const patchBlocksQuiet = (nextBlocks: MemoryBlock[]) => {
    setDraft({ ...draft, blocks: nextBlocks })
  }

  const setBlock = (id: string, next: MemoryBlock) => {
    patchBlocksQuiet(draft.blocks.map((b) => (b.id === id ? next : b)))
  }

  const removeBlock = (id: string) => {
    const gone = draft.blocks.find((b) => b.id === id)
    if (gone) revokeBlockUrls([gone])
    const nextBlocks = draft.blocks.filter((b) => b.id !== id)
    if (gone && editingKind === gone.kind) setEditingKind(null)
    commitBlocks(nextBlocks)
  }

  const beginEdit = (kind: MemoryBlockKind) => {
    if (draft.blocks.some((b) => b.kind === kind)) return
    noteActivity()
    setEditingKind(kind)
    setDraft({ ...draft, blocks: [...draft.blocks, emptyBlock(kind)] })
  }

  const askYoshiHelp = () => {
    if (!helperYoshi) return
    const copy = yoshiHelpDraft(helperYoshi, userName)
    setDraft({
      ...draft,
      title: copy.title,
      body: copy.body,
      author: { kind: 'yoshi', yoshiId: helperYoshi.id },
    })
    setHelpOfferVisible(false)
    setHelpOfferExpanded(false)
  }

  const clearYoshiCredit = () => {
    setDraft({ ...draft, author: { kind: 'user' } })
  }

  const authorInfo = draft.author
  const author =
    authorInfo.kind === 'yoshi'
      ? yoshis.find((y) => y.id === authorInfo.yoshiId)
      : undefined

  const hasContent =
    draft.title.trim().length > 0 ||
    draft.body.trim().length > 0 ||
    draft.blocks.some(blockHasContent)

  const cards: {
    key: string
    portrait: boolean
    raised: boolean
    node: ReactNode
  }[] = []

  stackOrder.forEach((kind) => {
    if (kind === 'location' || kind === 'mood') return
    const block = draft.blocks.find((b) => b.kind === kind)
    // Content / active edit floats above empty placeholders in the overlap
    const raised = editingKind === kind || blockHasContent(block)

    if (kind === 'photos') {
      cards.push({
        key: 'photos',
        portrait: true,
        raised,
        node: block?.urls[0] ? (
          <PhotoBleedCard
            url={block.urls[0]}
            onRemove={() => removeBlock(block.id)}
          />
        ) : (
          <PhotoAddCard
            onPick={(url) => {
              if (block) {
                const next = {
                  ...block,
                  urls: [url],
                } as Extract<MemoryBlock, { kind: 'photos' }>
                const nextBlocks = draft.blocks.map((b) =>
                  b.id === block.id ? next : b,
                )
                if (editingKind) patchBlocksQuiet(nextBlocks)
                else commitBlocks(nextBlocks)
              } else {
                const created = emptyBlock('photos') as Extract<
                  MemoryBlock,
                  { kind: 'photos' }
                >
                created.urls = [url]
                const nextBlocks = [...draft.blocks, created]
                if (editingKind) patchBlocksQuiet(nextBlocks)
                else commitBlocks(nextBlocks)
              }
            }}
          />
        ),
      })
      return
    }

    if (!block) {
      cards.push({
        key: kind,
        portrait: kind === 'memo',
        raised: false,
        node: <AddCard kind={kind} onAdd={() => beginEdit(kind)} />,
      })
      return
    }

    cards.push({
      key: kind,
      portrait: kind === 'memo',
      raised,
      node: (
        <FilledCard
          block={block}
          autoFocus={kind === 'memo' && editingKind === 'memo'}
          onChange={(next) => setBlock(block.id, next)}
          onRemove={() => removeBlock(block.id)}
          onMemoBlur={() => {
            setDraft((d) => {
              if (!d) return d
              const current = d.blocks.find((b) => b.id === block.id)
              if (!current || current.kind !== 'memo') return d
              if (!current.text.trim()) {
                revokeBlockUrls([current])
                const nextBlocks = d.blocks.filter((b) => b.id !== current.id)
                setEditingKind(null)
                setStackOrder(orderByContent(nextBlocks))
                return { ...d, blocks: nextBlocks }
              }
              setEditingKind(null)
              setStackOrder(orderByContent(d.blocks))
              return d
            })
          }}
          onVoiceCommit={(clip) => {
            setDraft((d) => {
              if (!d) return d
              const nextBlocks = d.blocks.map((b) =>
                b.id === block.id && b.kind === 'voice'
                  ? clip
                    ? {
                        ...b,
                        url: clip.url,
                        seconds: clip.seconds,
                        peaks: clip.peaks,
                      }
                    : { ...b, url: '', seconds: 0, peaks: [] }
                  : b,
              )
              // Clearing for re-record stays in edit; a finished clip can reflow
              if (clip) {
                setEditingKind(null)
                setStackOrder(orderByContent(nextBlocks))
              } else {
                setEditingKind('voice')
              }
              return { ...d, blocks: nextBlocks }
            })
          }}
          onVoiceCancel={() => removeBlock(block.id)}
        />
      ),
    })
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
        onClick={hide}
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
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
          style={{
            paddingTop: 'var(--nav-top, 56px)',
            flexShrink: 0,
            touchAction: 'none',
            cursor: 'grab',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 20px 0',
              position: 'relative',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 40,
                height: 5,
                borderRadius: 999,
                background: 'rgba(23,21,28,0.14)',
              }}
            />
            <button
              type="button"
              onClick={discard}
              aria-label="Close"
              style={{ ...circleBtn, position: 'absolute', right: 20 }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>✕</span>
            </button>
          </div>
          <div aria-hidden style={{ height: 12 }} />
        </div>

        <div
          className="fuibo-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `14px 24px ${Math.max(120, 120 + keyboardInset + (editingKind ? 80 : 0))}px`,
            WebkitOverflowScrolling: 'touch',
            // Fade cards out as they approach the sticky Done footer
            WebkitMaskImage:
              'linear-gradient(to bottom, #000 0%, #000 calc(100% - 110px), transparent 100%)',
            maskImage:
              'linear-gradient(to bottom, #000 0%, #000 calc(100% - 110px), transparent 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <AutoTextarea
              value={draft.title}
              onChange={(title) => patch({ title })}
              placeholder="Memory Title"
              style={{
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1.14,
                letterSpacing: '-.02em',
                color: '#433A33',
              }}
            />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  minHeight: 34,
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
                {helpOfferVisible && helperYoshi && !author ? (
                  <button
                    type="button"
                    className={`ms-draft-offer${helpOfferExpanded ? ' is-expanded' : ''}`}
                    onClick={askYoshiHelp}
                    aria-label="Want me to draft?"
                  >
                    <img
                      src={helperYoshi.image}
                      alt=""
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flex: 'none',
                      }}
                    />
                    <span className="ms-draft-offer-label">
                      Want me to draft?
                    </span>
                  </button>
                ) : null}
              </div>
              {author ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 34,
                  }}
                >
                  <span
                    style={{
                      ...stampChip,
                      gap: 7,
                      paddingTop: 5,
                      paddingBottom: 5,
                      paddingLeft: 5,
                      paddingRight: mode === 'compose' ? 5 : 12,
                    }}
                  >
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
                    {mode === 'compose' ? (
                      <button
                        type="button"
                        onClick={clearYoshiCredit}
                        aria-label="Remove Yoshi credit"
                        title="Keep the words, remove the credit"
                        style={{
                          width: 18,
                          height: 18,
                          marginLeft: 2,
                          border: 'none',
                          borderRadius: '50%',
                          background: 'rgba(23,21,28,0.08)',
                          color: '#7B7786',
                          fontSize: 11,
                          lineHeight: 1,
                          cursor: 'pointer',
                          padding: 0,
                          fontFamily: 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </div>

            <AutoTextarea
              value={draft.body}
              onChange={(body) => patch({ body })}
              placeholder={
                "A little something from today…\nWhat made this moment feel worth keeping?"
              }
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: '#2C241C',
                minHeight: draft.body ? undefined : 44,
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 40,
            }}
          >
            {cards.map((card, i) => (
              <div
                key={card.key}
                style={{
                  // Portrait ~reference collage size; voice stays wide landscape
                  width: card.portrait ? '58%' : '82%',
                  alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
                  // Deep stagger so cards tuck under each other like the mock
                  marginTop: i === 0 ? 0 : card.portrait ? -56 : -28,
                  transform: `rotate(${i % 2 === 0 ? -1.2 : 1.4}deg)`,
                  // Filled / editing cards sit above empty placeholders in the collage
                  zIndex: (card.raised ? 40 : 0) + i + 1,
                }}
              >
                {card.node}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            pointerEvents: 'none',
            padding:
              '28px 24px calc(44px + var(--safe-bottom, 0px))',
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.92) 42%, #FFFFFF 72%)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            disabled={!hasContent}
            onClick={() => onSave(draft)}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: '#FFFFFF',
              borderRadius: 24,
              border: '1.5px solid #17151C',
              padding: '8px 12px 8px 18px',
              fontSize: 17,
              lineHeight: 1.25,
              fontFamily: 'inherit',
              fontWeight: 600,
              textAlign: 'left',
              color: '#17151C',
              boxShadow: '0 8px 22px rgba(26,24,20,.22)',
              cursor: hasContent ? 'pointer' : 'default',
              opacity: hasContent ? 1 : 0.45,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{mode === 'compose' ? 'Plant it' : 'Done'}</span>
            <span
              aria-hidden
              style={{
                flex: 'none',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#17151C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mode === 'compose' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="3.2" fill="#fff" />
                  <circle cx="16.2" cy="11" r="3.2" fill="#fff" />
                  <circle cx="14.6" cy="15.8" r="3.2" fill="#fff" />
                  <circle cx="9.4" cy="15.8" r="3.2" fill="#fff" />
                  <circle cx="7.8" cy="11" r="3.2" fill="#fff" />
                  <circle cx="12" cy="12" r="2.4" fill="#F4C84A" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2.5 7.2L5.4 10.1L11.5 3.8"
                    stroke="#fff"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
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
  autoFocus,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: CSSProperties
  autoFocus?: boolean
  onBlur?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  useEffect(() => {
    if (!autoFocus) return
    const el = ref.current
    if (!el) return
    // rAF so the sheet/card finish laying out before focusing (opens keyboard)
    const id = requestAnimationFrame(() => {
      el.focus()
      const card = el.closest('[data-memory-card]') as HTMLElement | null
      if (card) {
        // Immediate nudge; a second pass runs after the keyboard animates
        window.setTimeout(() => scrollCardAboveKeyboard(card), 40)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [autoFocus])

  return (
    <textarea
      ref={ref}
      className="ms-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        // Stay in edit if focus moves to delete / another control on this card
        const card = e.currentTarget.closest('[data-memory-card]')
        const next = e.relatedTarget as Node | null
        if (card && next && card.contains(next)) return
        onBlur?.()
      }}
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
  const portrait = kind === 'memo'
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: portrait ? undefined : 168,
        aspectRatio: portrait ? '4 / 5' : undefined,
        border: '1.6px dashed #D6D3E0',
        borderRadius: 22,
        background: '#FFFFFF',
        boxShadow: '0 8px 26px rgba(20,17,26,0.10)',
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

/** ⋯ expands left into Delete — shared by photo + filled cards. */
function CardMoreDelete({
  onDelete,
  tone = 'light',
}: {
  onDelete: () => void
  tone?: 'light' | 'onMedia'
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 2800)
    return () => window.clearTimeout(t)
  }, [armed])

  const idleBg =
    tone === 'onMedia' ? 'rgba(20,17,26,0.55)' : 'rgba(23,21,28,0.08)'
  const idleFg = tone === 'onMedia' ? '#fff' : '#5A5666'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!armed) {
          setArmed(true)
          return
        }
        onDelete()
      }}
      aria-label={armed ? 'Delete' : 'Card options'}
      aria-expanded={armed}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 2,
        height: 28,
        width: armed ? 78 : 28,
        borderRadius: 999,
        border: 'none',
        background: armed ? '#E2574C' : idleBg,
        color: '#fff',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        transition:
          'width 220ms cubic-bezier(0.32, 0.72, 0, 1), background 180ms ease',
      }}
    >
      {armed ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1Z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M6.5 7l1 12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12"
              stroke="#fff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M10 11v6M14 11v6"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 650 }}>Delete</span>
        </>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="3.2" cy="7" r="1.25" fill={idleFg} />
          <circle cx="7" cy="7" r="1.25" fill={idleFg} />
          <circle cx="10.8" cy="7" r="1.25" fill={idleFg} />
        </svg>
      )}
    </button>
  )
}

function CardShell({
  tint,
  onRemove,
  children,
  portrait,
  minHeight,
  kind,
}: {
  tint: string
  onRemove: () => void
  children: ReactNode
  portrait?: boolean
  minHeight?: number
  kind?: MemoryBlockKind
}) {
  return (
    <div
      data-memory-card
      data-kind={kind}
      style={{
        position: 'relative',
        borderRadius: 22,
        background: tint,
        boxShadow: '0 8px 26px rgba(20,17,26,0.10)',
        // Extra room at the foot so the next card's overlap never eats content
        padding: '18px 18px 34px',
        aspectRatio: portrait ? '4 / 5' : undefined,
        minHeight,
        boxSizing: 'border-box',
        display: portrait || minHeight ? 'flex' : undefined,
        flexDirection: portrait || minHeight ? 'column' : undefined,
      }}
    >
      <CardMoreDelete onDelete={onRemove} tone="light" />
      {children}
    </div>
  )
}

function FilledCard({
  block,
  onChange,
  onRemove,
  autoFocus,
  onMemoBlur,
  onVoiceCommit,
  onVoiceCancel,
}: {
  block: MemoryBlock
  onChange: (next: MemoryBlock) => void
  onRemove: () => void
  autoFocus?: boolean
  onMemoBlur?: () => void
  onVoiceCommit?: (clip: VoiceClip | null) => void
  onVoiceCancel?: () => void
}) {
  const meta = CARD_META[block.kind]

  return (
    <CardShell
      kind={block.kind}
      tint={meta.tint}
      onRemove={onRemove}
      portrait={block.kind === 'memo'}
      // Match AddCard height so opening voice doesn't shove the collage
      minHeight={block.kind === 'voice' ? 168 : undefined}
    >
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
          autoFocus={autoFocus}
          onBlur={onMemoBlur}
          placeholder="Anything worth remembering…"
          style={{
            flex: 1,
            fontSize: 14,
            lineHeight: 1.7,
            color: '#3B3520',
          }}
        />
      ) : null}

      {block.kind === 'location' ? (
        <LocationCard block={block} onChange={onChange} />
      ) : null}

      {block.kind === 'voice' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <VoiceNote
            clip={
              block.url
                ? {
                    url: block.url,
                    seconds: block.seconds,
                    peaks: block.peaks,
                  }
                : null
            }
            onChange={(clip: VoiceClip | null) => {
              if (onVoiceCommit) {
                onVoiceCommit(clip)
                return
              }
              onChange(
                clip
                  ? {
                      ...block,
                      url: clip.url,
                      seconds: clip.seconds,
                      peaks: clip.peaks,
                    }
                  : { ...block, url: '', seconds: 0, peaks: [] },
              )
            }}
            onCancel={onVoiceCancel}
          />
        </div>
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

/** Dashed photo tile — tap opens the camera roll immediately. */
function PhotoAddCard({ onPick }: { onPick: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const meta = CARD_META.photos

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 5',
        border: '1.6px dashed #D6D3E0',
        borderRadius: 22,
        background: '#FFFFFF',
        boxShadow: '0 8px 26px rgba(20,17,26,0.10)',
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          if (file) onPick(URL.createObjectURL(file))
          e.currentTarget.value = ''
        }}
        style={{ display: 'none' }}
      />
    </button>
  )
}

/** One photo fills a portrait card frame. */
function PhotoBleedCard({
  url,
  onRemove,
}: {
  url: string
  onRemove: () => void
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 5',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 8px 26px rgba(20,17,26,0.12)',
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
      <CardMoreDelete
        tone="onMedia"
        onDelete={() => {
          URL.revokeObjectURL(url)
          onRemove()
        }}
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
