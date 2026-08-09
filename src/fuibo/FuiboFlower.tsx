import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { IOSDevice, KB_ANIM_MS } from '../components/IOSDevice'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useCompactViewport } from '../hooks/useCompactViewport'
import { isTextField } from '../lib/fakeKeyboardInput'
import { TopicDrawer } from './TopicDrawer'
import { SwitchYoshi } from './SwitchYoshi'
import { getYoshi } from './yoshis'
import { toSwitchYoshi, type OwnedYoshi } from './ownedYoshis'
type LinkPreview = {
  url: string
  domain: string
  title: string
  description: string
  image: string
}

type TopicNote = {
  label: string
  detail: string
}

type Msg =
  | {
      type: 'them'
      text: string
      image?: string
      link?: LinkPreview
      note?: TopicNote
    }
  | { type: 'me'; text: string }
  | { type: 'divider' }

type TopicPayload = {
  text: string
  image?: string
  link?: LinkPreview
  note?: TopicNote
}

/** First message after tapping a topic card — straight to the point + media */
const TOPIC_PAYLOADS: TopicPayload[] = [
  {
    text: 'Saturday, 11am at Riverside Park — take me with you!',
    link: {
      url: 'https://riversidepark.events/dog-show',
      domain: 'riversidepark.events',
      title: 'Riverside Dog Show — Weekend Edition',
      description:
        'Outdoor rings, puppies, and treat stalls this Saturday & Sunday.',
      image: '/assets/topics/dog-show-preview.png',
    },
  },
  {
    text: 'So… how did that 1:1 with your manager go?',
  },
  {
    text: 'This is the one — slow, warm, easy to fall into.',
    link: {
      url: 'https://watch.example/soft-hours',
      domain: 'watch.example',
      title: 'Soft Hours',
      description: 'A quiet series for nights when you mostly want company.',
      image: '/assets/topics/quiet-show-preview.png',
    },
  },
]

const HOME_TOPIC = "Let's chattt"
const HOME_TIP = 'Wanna see the baby version of your rabbit?'

const HOME_TOPIC_PAYLOAD: TopicPayload = {
  text: 'Remember when you showed me your rabbit? This is how they’d look as a baby.',
  image: '/assets/topics/baby-rabbit.png',
}

function ChatLinkPreview({ link }: { link: LinkPreview }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'block',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#F4F2F7',
        textDecoration: 'none',
        color: 'inherit',
        marginBottom: 8,
        border: '1px solid rgba(26,24,20,0.06)',
        flexShrink: 0,
      }}
    >
      <img
        src={link.image}
        alt=""
        style={{
          width: '100%',
          height: 128,
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0,
        }}
      />
      <div style={{ padding: '10px 12px 12px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'rgba(26,24,20,0.45)',
            marginBottom: 4,
          }}
        >
          {link.domain}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: '#17151C',
            lineHeight: 1.3,
          }}
        >
          {link.title}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12.5,
            lineHeight: 1.35,
            color: 'rgba(26,24,20,0.55)',
          }}
        >
          {link.description}
        </div>
      </div>
    </a>
  )
}

function ChatNoteCard({ note }: { note: TopicNote }) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: '#FBF3DC',
        border: '1px solid rgba(192,90,60,0.12)',
        padding: '12px 14px',
        marginBottom: 8,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(42,38,32,0.45)',
          marginBottom: 6,
        }}
      >
        Context
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#2A2620',
          letterSpacing: '-0.02em',
        }}
      >
        {note.label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 13,
          color: 'rgba(42,38,32,0.55)',
        }}
      >
        {note.detail}
      </div>
    </div>
  )
}

const INITIAL_THREAD: Msg[] = [
  {
    type: 'them',
    text: 'This is a sample text that is filling as Lorem Ipsum just to test out how this looks.',
  },
  {
    type: 'them',
    text: 'This is a sample text that is filling as Lorem Ipsum just to test out how this looks.\n\nReady?',
  },
  { type: 'me', text: 'Yes' },
]

const TITLE_TOP = 136
const TITLE_TO_HERO_GAP = 15
const DEFAULT_CHAT_BG_Y = 20
const CHAT_BG_STORAGE_KEY = 'fuibo-chat-bg-y'

function loadChatBgY(imageKey: string) {
  try {
    const raw = localStorage.getItem(CHAT_BG_STORAGE_KEY)
    if (!raw) return DEFAULT_CHAT_BG_Y
    const map = JSON.parse(raw) as Record<string, number>
    const value = map[imageKey]
    return typeof value === 'number'
      ? Math.max(0, Math.min(100, value))
      : DEFAULT_CHAT_BG_Y
  } catch {
    return DEFAULT_CHAT_BG_Y
  }
}

function saveChatBgY(imageKey: string, value: number) {
  try {
    const raw = localStorage.getItem(CHAT_BG_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    map[imageKey] = Math.max(0, Math.min(100, value))
    localStorage.setItem(CHAT_BG_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Prototype: ignore persistence failures
  }
}

/** Sample top hero control areas; returns one shared icon color for contrast. */
function sampleChatControlColor(
  src: string,
  bgY: number,
  viewW = 402,
  viewH = 312,
): Promise<'#FFFFFF' | '#17151C'> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = viewW
        canvas.height = viewH
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve('#17151C')
          return
        }
        const scale = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight)
        const dw = img.naturalWidth * scale
        const dh = img.naturalHeight * scale
        const dx = (viewW - dw) * 0.5
        const dy = (viewH - dh) * (Math.max(0, Math.min(100, bgY)) / 100)
        ctx.drawImage(img, dx, dy, dw, dh)

        const sampleY = 64
        const sampleW = 52
        const sampleH = 52
        const regions = [
          ctx.getImageData(20, sampleY, sampleW, sampleH).data,
          ctx.getImageData(Math.max(0, viewW - 20 - 52), sampleY, sampleW, sampleH)
            .data,
        ]

        let total = 0
        let count = 0
        for (const data of regions) {
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const a = data[i + 3]
            if (a < 20) continue
            total += 0.2126 * r + 0.7152 * g + 0.0722 * b
            count += 1
          }
        }
        const avg = count ? total / count : 180
        resolve(avg < 150 ? '#FFFFFF' : '#17151C')
      } catch {
        resolve('#17151C')
      }
    }
    img.onerror = () => resolve('#17151C')
    img.src = src
  })
}

function PencilIcon({ color = '#17151C' }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M12.4 2.9a1.5 1.5 0 012.1 2.1L6.2 13.3 3 14.9l1.6-3.2L12.4 2.9z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10.9 4.4l2.7 2.7"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BgAdjustHintArrow({ dir }: { dir: 'up' | 'down' }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        animation:
          dir === 'up'
            ? 'meetHintArrowYUp 1.1s ease-in-out infinite'
            : 'meetHintArrowY 1.1s ease-in-out infinite',
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        style={{ transform: dir === 'up' ? 'rotate(-90deg)' : 'rotate(90deg)' }}
      >
        <path
          d="M5 13h15.5M14.2 6.5 20.5 13l-6.3 6.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function ThinkingIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: 'translate(0.5px, -1.5px)' }}
    >
      <path
        d="M8.2 4.2c-2.45 0-4.45 1.85-4.45 4.15 0 .72.2 1.4.55 2-.95.7-1.55 1.75-1.55 2.95 0 2.15 1.9 3.9 4.25 3.9h8.1c2.55 0 4.6-1.9 4.6-4.25 0-1.55-.9-2.9-2.2-3.6.15-.4.25-.85.25-1.3 0-2.45-2.15-4.45-4.8-4.45-1.4 0-2.65.55-3.5 1.45-.55-.55-1.3-.9-2.15-.9Z"
        fill="#FFF8F3"
      />
      <circle cx="6.1" cy="18.1" r="1.55" fill="#FFF8F3" />
      <circle cx="3.55" cy="20.9" r="1" fill="#FFF8F3" />
    </svg>
  )
}

/** Clean swap glyph for Switch Yoshi (replaces the emoji). */
function SwitchYoshiIcon({ color = '#17151C' }: { color?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h10.5M15.5 3.5L19.5 7l-4 3.5"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17H5.5M8.5 20.5L4.5 17l4-3.5"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <div
      style={{
        width: 11,
        height: 11,
        borderRight: '2.5px solid #17151C',
        borderBottom: '2.5px solid #17151C',
        transform: open ? 'rotate(225deg)' : 'rotate(45deg)',
        transition: 'transform .3s ease',
        marginTop: open ? 6 : -5,
      }}
    />
  )
}

function BackArrow({ color = '#17151C' }: { color?: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 19,
        height: 2.5,
        background: color,
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
          borderLeft: `2.5px solid ${color}`,
          borderBottom: `2.5px solid ${color}`,
          transform: 'translateY(-50%) rotate(45deg)',
        }}
      />
    </div>
  )
}

type FuiboFlowerProps = {
  userName?: string
  yoshis: OwnedYoshi[]
  activeYoshiId: string
  emptySlots?: number
  onSelectYoshi?: (id: string) => void
  /** Temporary: homepage menu restarts onboarding for testing */
  onRestartOnboarding?: () => void
  /** Create another Yoshi from Switch (short onboarding path) */
  onAddYoshi?: () => void
}

export function FuiboFlower({
  userName = '',
  yoshis,
  activeYoshiId,
  emptySlots = 0,
  onSelectYoshi,
  onRestartOnboarding,
  onAddYoshi,
}: FuiboFlowerProps) {
  const [screen, setScreen] = useState<'home' | 'chat' | 'game' | 'switch'>('home')
  const activeOwned =
    yoshis.find((y) => y.id === activeYoshiId) ?? yoshis[0]
  const template = getYoshi(activeOwned?.templateId ?? 'fuibo-flower')
  const yoshi = {
    id: activeOwned?.id ?? template.id,
    name: activeOwned?.name ?? template.name,
    image: activeOwned?.image ?? template.image,
    accent: template.accent,
  }
  const switchList = useMemo(
    () => yoshis.map(toSwitchYoshi),
    [yoshis],
  )
  const knownUserName = userName.trim() || 'friend'
  const [open, setOpen] = useState(false)
  const [homeTipOpen, setHomeTipOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [kb, setKb] = useState(false)
  const [attach, setAttach] = useState(false)
  const [thread, setThread] = useState<Msg[]>(INITIAL_THREAD)
  const [draft, setDraft] = useState('')
  const [chatBgY, setChatBgY] = useState(DEFAULT_CHAT_BG_Y)
  const [bgEditing, setBgEditing] = useState(false)
  const [bgHint, setBgHint] = useState(true)
  const [chatControlColor, setChatControlColor] = useState<'#FFFFFF' | '#17151C'>(
    '#17151C',
  )

  const compact = useCompactViewport()
  const threadRef = useRef<HTMLDivElement>(null)
  const titleBlockRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const dragMoved = useRef(false)
  const bgDrag = useRef<{ startClientY: number; startY: number } | null>(null)
  const backSwipe = useRef<{
    pointerId: number
    startX: number
    startY: number
    startT: number
    axis: 'none' | 'h' | 'v'
    dragging: boolean
  } | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const [swipeDragging, setSwipeDragging] = useState(false)
  const [shellW, setShellW] = useState(390)
  const exitTimer = useRef(0)
  // Default assumes two title lines; one-liners pull the image up once measured
  const [heroTop, setHeroTop] = useState(TITLE_TOP + 48 * 1.2 * 2 + TITLE_TO_HERO_GAP)
  const titleTop = compact
    ? 'calc(var(--nav-top, 12px) + 72px)'
    : TITLE_TOP
  // Raise image + bottom actions together (larger = shorter hero)
  const homeLift = 8
  const homeBottom = compact
    ? `calc(${20 + homeLift}px + var(--safe-bottom, 0px))`
    : 34 + homeLift
  const bubbleBottom = compact
    ? `calc(${22 + homeLift}px + var(--safe-bottom, 0px))`
    : 36 + homeLift
  const heroBottom = compact
    ? `calc(${40 + homeLift}px + var(--safe-bottom, 0px))`
    : 56 + homeLift
  const homeTipBottom = compact
    ? `calc(${96 + homeLift}px + var(--safe-bottom, 0px))`
    : 110 + homeLift

  const keyboardInset = useKeyboardInset()
  const kbVisible = kb && !open && !bgEditing
  const badge = !seen && !open
  // Thread bottom always matches the live composer height (same gap with/without keyboard).
  const composerPb = kb ? 12 : 34
  const desktopComposerH = 10 + 52 + composerPb
  const attachBottom = desktopComposerH
  // Mobile: real keyboard inset pushes the composer + thread up.
  const mobileComposerPad = kbVisible
    ? 8
    : 'calc(8px + var(--safe-bottom, 0px))'
  const mobileComposerH = 10 + 52 + 8
  const mobileKbLift = compact ? keyboardInset : 0
  const mobileAttachBottom = mobileComposerH + 8 + mobileKbLift
  const mobileThreadBottom = kbVisible
    ? mobileComposerH + mobileKbLift
    : `calc(${mobileComposerH}px + var(--safe-bottom, 0px))`
  const threadBottom = compact ? mobileThreadBottom : desktopComposerH
  const composerBottom = compact ? mobileKbLift : 0
  const kbMotion = `${KB_ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
  const chatBgKey = yoshi.image

  useEffect(() => {
    setChatBgY(loadChatBgY(chatBgKey))
    setBgEditing(false)
    bgDrag.current = null
  }, [chatBgKey])

  useEffect(() => {
    if (screen !== 'chat') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void sampleChatControlColor(yoshi.image, chatBgY).then((color) => {
        if (!cancelled) setChatControlColor(color)
      })
    }, bgEditing ? 60 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [screen, yoshi.image, chatBgY, bgEditing])

  useLayoutEffect(() => {
    const el = titleBlockRef.current
    if (!el || screen !== 'home') return
    const measure = () => {
      // Prefer measured title position so mobile (--nav-top) and desktop stay aligned
      setHeroTop(el.offsetTop + el.offsetHeight + TITLE_TO_HERO_GAP)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [yoshi.name, screen, compact, titleTop])

  useEffect(() => {
    const el = threadRef.current
    if (!el || screen !== 'chat') return

    const pin = () => {
      el.scrollTop = el.scrollHeight
    }
    pin()

    // Keep the latest message glued to the bottom while keyboard height animates (open + close).
    let raf = 0
    const started = performance.now()
    const tick = (now: number) => {
      pin()
      if (now - started < KB_ANIM_MS + 40) {
        raf = window.requestAnimationFrame(tick)
      }
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [thread.length, kb, screen, keyboardInset])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'fuibo-close-game') setScreen('home')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const startTopicPayload = (payload: TopicPayload) => {
    setScreen('chat')
    setOpen(false)
    setHomeTipOpen(false)
    setSeen(true)
    setKb(false)
    setAttach(false)
    setThread((t) => [
      ...t,
      { type: 'divider' },
      {
        type: 'them',
        text: payload.text,
        image: payload.image,
        link: payload.link,
        note: payload.note,
      },
    ])
  }

  const startTopic = (i: number) => {
    if (dragMoved.current) {
      dragMoved.current = false
      return
    }
    const payload = TOPIC_PAYLOADS[i]
    if (payload) startTopicPayload(payload)
  }

  const toggle = () => {
    setOpen((o) => !o)
    setHomeTipOpen(false)
    setSeen(true)
    setIdx((prev) => (open ? prev : 0))
    setAttach(false)
  }

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setThread((t) => [...t, { type: 'me', text }])
    setDraft('')
  }

  const BACK_EDGE = 28
  const BACK_EXIT_MS = 340
  const BACK_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

  const exitToHome = (animated = true) => {
    window.clearTimeout(exitTimer.current)
    if (bgEditing) {
      setChatBgY(loadChatBgY(chatBgKey))
      setBgEditing(false)
      bgDrag.current = null
    }
    setOpen(false)
    setKb(false)
    setAttach(false)
    setHomeTipOpen(false)

    if (!animated || screen !== 'chat') {
      setScreen('home')
      setSwipeX(0)
      setSwipeDragging(false)
      return
    }

    const w = shellRef.current?.clientWidth || shellW
    setSwipeDragging(false)
    setSwipeX(w)
    exitTimer.current = window.setTimeout(() => {
      setScreen('home')
      setSwipeX(0)
    }, BACK_EXIT_MS)
  }

  const onBackSwipeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (screen !== 'chat' || bgEditing || open) return
    const t = e.target as Element | null
    if (t?.closest?.('input, textarea, button, a, [role="button"]')) return
    const shell = shellRef.current
    if (!shell) return
    const localX = e.clientX - shell.getBoundingClientRect().left
    if (localX > BACK_EDGE) return

    backSwipe.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startT: performance.now(),
      axis: 'none',
      dragging: false,
    }
  }

  const onBackSwipeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = backSwipe.current
    if (!s || e.pointerId !== s.pointerId) return

    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY

    if (s.axis === 'none') {
      if (Math.hypot(dx, dy) < 8) return
      if (Math.abs(dy) >= Math.abs(dx) || dx < 0) {
        backSwipe.current = null
        return
      }
      s.axis = 'h'
      s.dragging = true
      setSwipeDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    if (s.axis !== 'h') return
    e.preventDefault()
    const w = shellRef.current?.clientWidth || shellW
    setSwipeX(Math.max(0, Math.min(w, dx)))
  }

  const onBackSwipeUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = backSwipe.current
    if (!s || e.pointerId !== s.pointerId) return
    backSwipe.current = null

    if (!s.dragging) {
      setSwipeDragging(false)
      return
    }

    const w = shellRef.current?.clientWidth || shellW
    const dx = Math.max(0, e.clientX - s.startX)
    const elapsed = Math.max(1, performance.now() - s.startT)
    const vx = dx / elapsed // px/ms
    const shouldComplete = dx / w > 0.32 || vx > 0.7

    setSwipeDragging(false)
    if (shouldComplete) exitToHome(true)
    else setSwipeX(0)
  }

  useEffect(() => {
    return () => window.clearTimeout(exitTimer.current)
  }, [])

  useEffect(() => {
    if (screen !== 'chat') return
    setSwipeX(0)
    setSwipeDragging(false)
    backSwipe.current = null
  }, [screen])

  useLayoutEffect(() => {
    if (screen !== 'home' && screen !== 'chat') return
    const el = shellRef.current
    if (!el) return
    const measure = () => setShellW(el.clientWidth || 390)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [screen])

  const beginBgEdit = () => {
    setBgEditing(true)
    setBgHint(true)
    setKb(false)
    setAttach(false)
    setOpen(false)
  }

  const saveBgEdit = () => {
    saveChatBgY(chatBgKey, chatBgY)
    setBgEditing(false)
    setBgHint(true)
    bgDrag.current = null
  }

  const onBgPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!bgEditing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    bgDrag.current = { startClientY: e.clientY, startY: chatBgY }
    setBgHint(false)
  }

  const onBgPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!bgEditing || !bgDrag.current) return
    const dy = e.clientY - bgDrag.current.startClientY
    // Drag image down -> show higher part of photo (lower object-position Y)
    const next = bgDrag.current.startY - (dy / 220) * 100
    setChatBgY(Math.max(0, Math.min(100, next)))
  }

  const onBgPointerUp = () => {
    bgDrag.current = null
  }

  const drawer = open ? (
    <>
      <div
        onClick={toggle}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          background: 'rgba(20,17,26,.68)',
          animation: 'fuiboScrimIn .25s ease',
          cursor: 'pointer',
        }}
      />
      <TopicDrawer
        idx={idx}
        onIdxChange={setIdx}
        onTapCard={startTopic}
        onClose={() => {
          setOpen(false)
          setSeen(true)
          setHomeTipOpen(false)
        }}
        getDragMoved={() => dragMoved.current}
        setDragMoved={(v) => {
          dragMoved.current = v
        }}
      />
    </>
  ) : null

  const home = (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'Geist', -apple-system, sans-serif",
        background: '#E9E6F8',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: heroTop,
          left: 18,
          right: 18,
          bottom: heroBottom,
          borderRadius: 26,
          overflow: 'hidden',
          boxShadow: '0 18px 44px rgba(26,24,20,.18)',
        }}
      >
        <img
          src={yoshi.image}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 20%',
            display: 'block',
          }}
          alt={yoshi.name}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 'var(--nav-top, 64px)',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          zIndex: 10,
        }}
      >
        <div
          onClick={onRestartOnboarding}
          title="Restart onboarding"
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 22,
              height: 2.5,
              borderRadius: 2,
              background: '#1A1814',
            }}
          />
          <div
            style={{
              width: 15,
              height: 2.5,
              borderRadius: 2,
              background: '#1A1814',
            }}
          />
        </div>
        <div
          onClick={() => {
            setOpen(false)
            setKb(false)
            setAttach(false)
            setScreen('game')
          }}
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: '#FBF3DC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            boxShadow: '0 2px 8px rgba(26,24,20,.08)',
            cursor: 'pointer',
          }}
          title="Mowing with Yoshi"
        >
          🚜
        </div>
      </div>

      <div
        ref={titleBlockRef}
        style={{
          position: 'absolute',
          top: titleTop,
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
            // Leave room for the switch control; wrap long names to 2 lines
            paddingRight: 90,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {yoshi.name}
        </div>
        {compact ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setScreen('switch')
            }}
            aria-label="Switch Yoshi"
            title="Switch Yoshi"
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 44,
              height: 44,
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#17151C',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <SwitchYoshiIcon />
          </button>
        ) : (
          <div
            onClick={() => {
              setOpen(false)
              setScreen('switch')
            }}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              fontSize: 32,
              color: '#17151C',
              cursor: 'pointer',
            }}
            title="Switch Yoshi"
          >
            ⇄
          </div>
        )}
      </div>

      {homeTipOpen && (
        <button
          type="button"
          onClick={() => startTopicPayload(HOME_TOPIC_PAYLOAD)}
          aria-label={`Start chat topic: ${HOME_TIP}`}
          style={{
            position: 'absolute',
            left: 30,
            bottom: homeTipBottom,
            maxWidth: 214,
            zIndex: 9,
            background: '#FFFFFF',
            borderRadius: '14px 14px 14px 4px',
            border: 'none',
            padding: '12px 15px',
            fontSize: 14,
            lineHeight: 1.4,
            fontFamily: 'inherit',
            textAlign: 'left',
            color: '#2A2620',
            boxShadow: '0 10px 26px rgba(26,24,20,.28)',
            cursor: 'pointer',
            animation: 'fuiboScrimIn .2s ease',
          }}
        >
          {HOME_TIP}
        </button>
      )}

      <div
        onClick={() => setHomeTipOpen((v) => !v)}
        role="button"
        aria-expanded={homeTipOpen}
        aria-label={
          homeTipOpen ? 'Hide topic tip' : `Show topic tip: ${HOME_TIP}`
        }
        style={{
          position: 'absolute',
          left: 30,
          bottom: homeBottom,
          zIndex: 8,
          width: 58,
          height: 58,
          borderRadius: '50%',
          boxSizing: 'border-box',
          background: '#C05A3C',
          border: '1.5px solid #FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 28px rgba(192,90,60,.45)',
          cursor: 'pointer',
        }}
      >
        <ThinkingIcon />
      </div>

      <button
        type="button"
        onClick={() => {
          setHomeTipOpen(false)
          setScreen('chat')
          setOpen(false)
        }}
        aria-label={`Chat with ${yoshi.name}, ${knownUserName}`}
        style={{
          position: 'absolute',
          right: 24,
          bottom: bubbleBottom,
          maxWidth: 248,
          zIndex: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          background: '#FFFFFF',
          borderRadius: 24,
          border: '1.5px solid #17151C',
          padding: '8px 12px 8px 18px',
          fontSize: 17,
          lineHeight: 1.25,
          fontFamily: 'inherit',
          fontWeight: 500,
          textAlign: 'left',
          color: '#17151C',
          boxShadow: '0 8px 22px rgba(26,24,20,.22)',
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{HOME_TOPIC}</span>
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
          <svg width="24" height="24" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 7h7.5M7.5 3.5L11 7l-3.5 3.5"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div
        onClick={toggle}
        style={{
          position: 'absolute',
          top: 'var(--nav-top, 64px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(26,24,20,.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Chevron open={open} />
          {badge && (
            <div
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 19,
                height: 19,
                borderRadius: '50%',
                background: '#D9442B',
                color: '#fff',
                font: "600 10.5px 'Geist',sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #E9E6F8',
                boxSizing: 'content-box',
              }}
            >
              3
            </div>
          )}
        </div>
      </div>

      {drawer}
    </div>
  )

  const chat = (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'Geist', -apple-system, sans-serif",
        background: '#EDECF2',
      }}
    >
      <img
        src={yoshi.image}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 312,
          width: '100%',
          objectFit: 'cover',
          objectPosition: `50% ${chatBgY}%`,
          borderRadius: '0 0 28px 28px',
          display: 'block',
          zIndex: 0,
        }}
        alt={yoshi.name}
      />

      {bgEditing && (
        <div
          onPointerDown={onBgPointerDown}
          onPointerMove={onBgPointerMove}
          onPointerUp={onBgPointerUp}
          onPointerCancel={onBgPointerUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 312,
            zIndex: 8,
            borderRadius: '0 0 28px 28px',
            cursor: 'ns-resize',
            touchAction: 'none',
            background: 'transparent',
          }}
        >
          {bgHint && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 28,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: '#fff',
                textAlign: 'center',
                textShadow: '0 2px 12px rgba(0,0,0,0.45)',
                animation: 'meetHintScrimIn .35s ease both',
                pointerEvents: 'none',
              }}
            >
              <BgAdjustHintArrow dir="up" />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Drag up / down
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    opacity: 0.75,
                  }}
                >
                  Adjust position
                </div>
              </div>
              <BgAdjustHintArrow dir="down" />
            </div>
          )}
        </div>
      )}

      <div
        ref={threadRef}
        className="fuibo-scroll"
        onClick={() => {
          if (kb) setKb(false)
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: threadBottom,
          overflowY: bgEditing ? 'hidden' : 'auto',
          pointerEvents: bgEditing ? 'none' : 'auto',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingTop: 250,
          paddingLeft: 18,
          paddingRight: 18,
          paddingBottom: 16,
          transition: `bottom ${kbMotion}`,
          // Edit mode: only soften bubbles that sit over the hero image
          WebkitMaskImage: bgEditing
            ? 'linear-gradient(to bottom, transparent 0px, transparent 160px, rgba(0,0,0,0.18) 240px, rgba(0,0,0,0.55) 290px, #000 330px)'
            : 'linear-gradient(to bottom,transparent 122px,#000 312px)',
          maskImage: bgEditing
            ? 'linear-gradient(to bottom, transparent 0px, transparent 160px, rgba(0,0,0,0.18) 240px, rgba(0,0,0,0.55) 290px, #000 330px)'
            : 'linear-gradient(to bottom,transparent 122px,#000 312px)',
          ...(compact
            ? {
                overscrollBehavior: 'contain' as const,
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y' as const,
              }
            : {}),
        }}
      >
        <div aria-hidden style={{ flex: '1 1 auto', minHeight: 0 }} />
        {thread.map((m, i) => {
          if (m.type === 'them') {
            const rich = Boolean(m.image || m.link || m.note)
            return (
              <div
                key={i}
                style={{
                  maxWidth: rich ? 280 : '80%',
                  width: rich ? '85%' : undefined,
                  alignSelf: 'flex-start',
                  flexShrink: 0,
                  background: '#FFFFFF',
                  borderRadius: 18,
                  padding: rich ? 10 : '14px 16px',
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: '#2A2620',
                  boxShadow: '0 4px 16px rgba(26,24,20,.10)',
                  animation: 'fuiboMsgIn .28s ease',
                  overflow: 'hidden',
                }}
              >
                {m.image && (
                  <img
                    src={m.image}
                    alt=""
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 12,
                      display: 'block',
                      flexShrink: 0,
                      marginBottom: m.text ? 10 : 0,
                    }}
                  />
                )}
                {m.link && <ChatLinkPreview link={m.link} />}
                {m.note && <ChatNoteCard note={m.note} />}
                {m.text ? (
                  <div
                    style={{
                      padding: rich ? '4px 6px 6px' : 0,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {m.text}
                  </div>
                ) : null}
              </div>
            )
          }
          if (m.type === 'me') {
            return (
              <div
                key={i}
                style={{
                  maxWidth: '80%',
                  alignSelf: 'flex-end',
                  flexShrink: 0,
                  background: '#CFE9DE',
                  borderRadius: 18,
                  padding: '14px 16px',
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: '#1E3A32',
                  boxShadow: '0 4px 16px rgba(26,24,20,.10)',
                  animation: 'fuiboMsgIn .28s ease',
                }}
              >
                {m.text}
              </div>
            )
          }
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                flexShrink: 0,
                animation: 'fuiboMsgIn .28s ease',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'rgba(26,24,20,.14)',
                }}
              />
              <div
                style={{
                  fontSize: 12.5,
                  color: 'rgba(26,24,20,.5)',
                  background: 'rgba(26,24,20,.06)',
                  borderRadius: 99,
                  padding: '5px 13px',
                  whiteSpace: 'nowrap',
                }}
              >
                topic started
              </div>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'rgba(26,24,20,.14)',
                }}
              />
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => exitToHome(true)}
        aria-label="Back"
        style={{
          position: 'absolute',
          top: 'var(--nav-top, 64px)',
          left: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 12,
          padding: 0,
          opacity: bgEditing ? 0.45 : 1,
          transition: 'opacity .2s ease',
        }}
      >
        <BackArrow color={chatControlColor} />
      </button>

      <div
        onClick={() => {
          if (bgEditing) saveBgEdit()
          else beginBgEdit()
        }}
        aria-label={bgEditing ? 'Save background' : 'Edit background'}
        style={{
          position: 'absolute',
          top: 'var(--nav-top, 64px)',
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 12,
        }}
      >
        {bgEditing ? (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: chatControlColor,
              letterSpacing: 0.2,
              textShadow:
                chatControlColor === '#FFFFFF'
                  ? '0 1px 2px rgba(0,0,0,.35)'
                  : '0 1px 2px rgba(255,255,255,.35)',
            }}
          >
            Save
          </span>
        ) : (
          <PencilIcon color={chatControlColor} />
        )}
      </div>

      <div
        onClick={toggle}
        style={{
          position: 'absolute',
          top: 'var(--nav-top, 64px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          cursor: bgEditing ? 'default' : 'pointer',
          pointerEvents: bgEditing ? 'none' : 'auto',
          opacity: bgEditing ? 0.45 : 1,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.62)',
            boxShadow: '0 4px 14px rgba(26,24,20,.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Chevron open={open} />
        </div>
      </div>

      {attach && (
        <>
          <div
            onClick={() => setAttach(false)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 14,
              cursor: 'pointer',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: compact ? mobileAttachBottom : attachBottom,
              zIndex: 16,
              width: 210,
              background: '#FFFFFF',
              borderRadius: 18,
              boxShadow: '0 16px 40px rgba(26,24,20,.24)',
              overflow: 'hidden',
              animation: 'fuiboSheetIn .2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '15px 18px',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(26,24,20,.07)',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 20,
                  border: '2px solid #C05A3C',
                  borderRadius: 5,
                  position: 'relative',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: 6,
                    width: 9,
                    height: 5,
                    border: '2px solid #C05A3C',
                    borderBottom: 'none',
                    borderRadius: '3px 3px 0 0',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#C05A3C',
                  }}
                />
              </div>
              <div style={{ fontSize: 15, color: '#2A2620' }}>Camera</div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '15px 18px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 20,
                  border: '2px solid #C05A3C',
                  borderRadius: 5,
                  position: 'relative',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: 2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#C05A3C',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: 0,
                    width: 0,
                    height: 0,
                    borderLeft: '9px solid transparent',
                    borderRight: '9px solid transparent',
                    borderBottom: '11px solid #C05A3C',
                  }}
                />
              </div>
              <div style={{ fontSize: 15, color: '#2A2620' }}>Upload image</div>
            </div>
          </div>
        </>
      )}

      <div
        data-keep-keyboard
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: composerBottom,
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: compact
            ? `10px 16px ${mobileComposerPad}${typeof mobileComposerPad === 'number' ? 'px' : ''}`
            : `10px 16px ${composerPb}px`,
          background: '#EDECF2',
          pointerEvents: bgEditing ? 'none' : 'auto',
          opacity: 1,
          transition: compact
            ? `bottom ${kbMotion}`
            : `padding ${kbMotion}`,
        }}
      >
        <div
          data-keep-keyboard
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 52,
            borderRadius: 26,
            background: '#FFFFFF',
            boxShadow: '0 2px 10px rgba(26,24,20,.07)',
            padding: '0 8px',
          }}
        >
          <div
            onClick={() => setAttach((a) => !a)}
            style={{
              flex: 'none',
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: attach ? '#F3D9CE' : '#FBEDE8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: '#C05A3C',
              cursor: 'pointer',
              lineHeight: 1,
              transform: attach ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform .25s ease',
            }}
          >
            +
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => {
              setKb(true)
              setAttach(false)
            }}
            onBlur={() => {
              // Keep keyboard up when focus moves into the fake keyboard / composer chrome
              window.setTimeout(() => {
                const active = document.activeElement
                if (active && isTextField(active)) return
                if (
                  active instanceof Element &&
                  active.closest('[data-ios-keyboard], [data-keep-keyboard]')
                ) {
                  return
                }
                setKb(false)
              }, 0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Message"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              fontFamily: "'Geist', -apple-system, sans-serif",
              color: kb ? '#2A2620' : 'rgba(26,24,20,.4)',
            }}
          />
        </div>
        <div
          onClick={send}
          aria-label="Send"
          style={{
            flex: 'none',
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#C05A3C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 18px rgba(192,90,60,.4)',
            cursor: 'pointer',
            color: '#fff',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M6.5 10.5L12 5l5.5 5.5"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {drawer}
    </div>
  )

  const game = (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        background: '#4d9fdd',
      }}
    >
      <iframe
        title={`Mowing with ${yoshi.name}`}
        src={`/mowing/mowing_with_yoshi.html?embed=1${compact ? '' : '&framed=1'}&avatar=${encodeURIComponent(yoshi.image)}&name=${encodeURIComponent(yoshi.name)}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="autoplay"
      />
    </div>
  )

  const switchScreen = (
    <SwitchYoshi
      yoshis={switchList}
      selectedId={yoshi.id}
      emptySlots={emptySlots}
      onBack={() => setScreen('home')}
      onSelect={(id) => {
        onSelectYoshi?.(id)
        setScreen('home')
      }}
      onAddYoshi={onAddYoshi}
    />
  )

  const swipeProgress =
    shellW > 0 ? Math.min(1, Math.max(0, swipeX / shellW)) : 0

  return (
    <IOSDevice
      // In chat: follow kb state when open; otherwise let focus auto-open the fake keyboard.
      keyboard={
        screen === 'chat' ? (kbVisible ? true : undefined) : false
      }
    >
      {screen === 'game' ? (
        game
      ) : screen === 'switch' ? (
        switchScreen
      ) : (
        <div
          ref={shellRef}
          style={{
            position: 'relative',
            height: '100%',
            overflow: 'hidden',
            background: '#E9E6F8',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              pointerEvents: screen === 'chat' ? 'none' : 'auto',
              transform:
                screen === 'chat'
                  ? `translateX(${-28 * (1 - swipeProgress)}px) scale(${0.96 + 0.04 * swipeProgress})`
                  : undefined,
              opacity: screen === 'chat' ? 0.9 + 0.1 * swipeProgress : 1,
              transformOrigin: 'center center',
              transition: swipeDragging
                ? 'none'
                : `transform ${BACK_EXIT_MS}ms ${BACK_EASE}, opacity ${BACK_EXIT_MS}ms ${BACK_EASE}`,
              willChange: screen === 'chat' ? 'transform, opacity' : undefined,
            }}
          >
            {home}
          </div>

          {screen === 'chat' && (
            <div
              onPointerDown={onBackSwipeDown}
              onPointerMove={onBackSwipeMove}
              onPointerUp={onBackSwipeUp}
              onPointerCancel={onBackSwipeUp}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                transform: `translateX(${swipeX}px)`,
                transition: swipeDragging
                  ? 'none'
                  : `transform ${BACK_EXIT_MS}ms ${BACK_EASE}`,
                boxShadow:
                  swipeX > 0
                    ? '-10px 0 28px rgba(20,17,26,0.22)'
                    : 'none',
                willChange: 'transform',
                touchAction: swipeDragging ? 'none' : 'pan-y',
              }}
            >
              {chat}
            </div>
          )}
        </div>
      )}
    </IOSDevice>
  )
}
