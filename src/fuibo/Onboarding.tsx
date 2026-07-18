import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
} from 'react'
import { IOSDevice } from '../components/IOSDevice'
import { DEFAULT_YOSHI_ID, getYoshi } from './yoshis'

export type OnboardingResult = {
  userName: string
  yoshiId: string
  yoshiName: string
  yoshiImage: string
  relationshipId: string
}

type Props = {
  onComplete: (result: OnboardingResult) => void
}

type Step =
  | 'splash'
  | 'welcome'
  | 'name'
  | 'birthday'
  | 'interests'
  | 'relationship'
  | 'meet'
  | 'nameYoshi'

const BG: CSSProperties = {
  background: 'linear-gradient(180deg, #E9E6F8 0%, #F3F1F8 42%, #FAFAFC 100%)',
}

const INK = '#1A2756'
const MUTED = 'rgba(26, 39, 86, 0.55)'

const RELATIONSHIP_TYPES = [
  {
    id: 'romance',
    yoshiId: 'lady-god',
    title: 'Romance',
    subtitle: 'Supportive, real chemistry',
    image: '/assets/onboarding/type-romance.png',
  },
  {
    id: 'friend',
    yoshiId: 'fuibo-flower',
    title: 'Friend',
    subtitle: 'Someone to talk to at 3 am',
    image: '/assets/onboarding/type-friend.png',
  },
  {
    id: 'parent',
    yoshiId: 'dad',
    title: 'Parent',
    subtitle: 'Someone who’s always proud of you',
    image: '/assets/onboarding/type-parent.png',
  },
] as const

const INTERESTS = [
  { id: 'anime', label: 'Anime', emoji: '🍥' },
  { id: 'gardening', label: 'Gardening', emoji: '🌿' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'sports', label: 'Sports', emoji: '🏀' },
  { id: 'games', label: 'Games', emoji: '🎮' },
  { id: 'history', label: 'History', emoji: '📜' },
  { id: 'investing', label: 'Investing', emoji: '📈' },
  { id: 'memes', label: 'Memes', emoji: '😂' },
] as const

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const REL_STRIDE = 300

function NextButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Next"
      style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: 'none',
        background: '#FFFFFF',
        boxShadow: '0 10px 28px rgba(26, 39, 86, 0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity .2s ease',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M8 4l7 7-7 7"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function ScreenShell({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'Geist', -apple-system, sans-serif",
        ...BG,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function AppleMark() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden>
      <path
        fill="#111"
        d="M14.7 11.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8C4.7 6.4 3 7.5 3 10.4c0 .9.2 1.8.5 2.8.4 1.3 1.9 4.6 3.5 4.5 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6c1.6 0 2.9-2.9 3.3-4.2-2.1-1-2-2.7-1.8-3.9zM12.6 4.3c.6-.7 1-1.7.9-2.7-1 .1-2.1.7-2.7 1.5-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.7-1.5z"
      />
    </svg>
  )
}

function AuthButton({
  label,
  iconSrc,
  onClick,
  apple,
}: {
  label: string
  iconSrc?: string
  apple?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        height: 56,
        borderRadius: 999,
        border: 'none',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        fontSize: 17,
        fontWeight: 500,
        color: '#111',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      {apple ? (
        <AppleMark />
      ) : (
        <img
          src={iconSrc}
          alt=""
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      )}
      {label}
    </button>
  )
}

function SplashStep({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), 2200)
    return () => clearTimeout(t)
  }, [])

  return (
    <ScreenShell>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          animation: 'fuiboSplashIn .7s ease both',
        }}
      >
        <img
          src="/assets/onboarding/logo.png"
          alt=""
          style={{
            width: 96,
            height: 96,
            objectFit: 'cover',
            borderRadius: 24,
            boxShadow: '0 16px 40px rgba(26,39,86,0.18)',
            animation: 'fuiboSplashPulse 1.6s ease-in-out infinite',
          }}
        />
        <div
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: INK,
          }}
        >
          Yoshi
        </div>
      </div>
    </ScreenShell>
  )
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <ScreenShell style={{ background: '#000' }}>
      <img
        src="/assets/onboarding/welcome-hero.png"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: '50% 30%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.78) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 28,
          right: 28,
          bottom: 52,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 2,
        }}
      >
        <AuthButton label="Continue with Apple" apple onClick={onContinue} />
        <AuthButton
          label="Continue with Google"
          iconSrc="/assets/onboarding/google.png"
          onClick={onContinue}
        />
        <p
          style={{
            margin: '8px 12px 0',
            textAlign: 'center',
            fontSize: 12,
            lineHeight: 1.45,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          By continuing, you agree to Yoshi’s{' '}
          <span style={{ color: '#fff', fontWeight: 500 }}>Terms of Service</span>{' '}
          and{' '}
          <span style={{ color: '#fff', fontWeight: 500 }}>Privacy Policy</span>
        </p>
      </div>
    </ScreenShell>
  )
}

function NameStep({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
}) {
  return (
    <ScreenShell>
      <div
        style={{
          padding: '120px 32px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
            textAlign: 'center',
          }}
        >
          What’s your name?
        </h1>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onNext()
          }}
          placeholder="Your name"
          style={{
            width: '100%',
            height: 58,
            borderRadius: 999,
            border: '1px solid rgba(26,39,86,0.08)',
            background: '#fff',
            boxShadow: '0 8px 24px rgba(26,39,86,0.08)',
            padding: '0 24px',
            fontSize: 20,
            fontWeight: 500,
            color: INK,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            textAlign: 'center',
          }}
        />
        <NextButton onClick={onNext} disabled={!value.trim()} />
      </div>
    </ScreenShell>
  )
}

const WHEEL_ITEM_H = 44
const WHEEL_VISIBLE = 5
const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE
const WHEEL_PAD = (WHEEL_H - WHEEL_ITEM_H) / 2

function DateWheel({
  items,
  index,
  onChange,
  flex = 1,
}: {
  items: (string | number)[]
  index: number
  onChange: (index: number) => void
  flex?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(index)
  const dragging = useRef(false)
  const dragMoved = useRef(false)
  const drag = useRef<{ y: number; top: number } | null>(null)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(index)
  indexRef.current = index

  const clampIndex = (i: number) =>
    Math.max(0, Math.min(items.length - 1, i))

  const indexFromScroll = (top: number) =>
    clampIndex(Math.round(top / WHEEL_ITEM_H))

  const settle = (el: HTMLDivElement, smooth = true) => {
    const next = indexFromScroll(el.scrollTop)
    if (smooth) {
      el.scrollTo({ top: next * WHEEL_ITEM_H, behavior: 'smooth' })
    } else {
      el.scrollTop = next * WHEEL_ITEM_H
    }
    setActive(next)
    if (next !== indexRef.current) onChange(next)
  }

  useEffect(() => {
    const el = ref.current
    if (!el || dragging.current) return
    el.scrollTop = index * WHEEL_ITEM_H
    setActive(index)
  }, [index])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    setActive(indexFromScroll(el.scrollTop))
    if (dragging.current) return
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => settle(el), 90)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    dragging.current = true
    dragMoved.current = false
    drag.current = { y: e.clientY, top: el.scrollTop }
    el.setPointerCapture(e.pointerId)
    if (snapTimer.current) clearTimeout(snapTimer.current)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !dragging.current) return
    const el = ref.current
    if (!el) return
    const dy = e.clientY - drag.current.y
    if (Math.abs(dy) > 3) dragMoved.current = true
    el.scrollTop = drag.current.top - dy
    setActive(indexFromScroll(el.scrollTop))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const el = ref.current
    dragging.current = false
    drag.current = null
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      settle(el)
    }
  }

  useEffect(
    () => () => {
      if (snapTimer.current) clearTimeout(snapTimer.current)
    },
    [],
  )

  return (
    <div
      ref={ref}
      className="fuibo-scroll"
      onScroll={onScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        flex,
        height: WHEEL_H,
        overflowY: 'auto',
        touchAction: 'none',
        cursor: 'grab',
        WebkitOverflowScrolling: 'touch',
        maskImage:
          'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
      }}
    >
      <div style={{ height: WHEEL_PAD, flexShrink: 0 }} />
      {items.map((item, i) => {
        const dist = Math.abs(i - active)
        const selected = dist === 0
        return (
          <div
            key={`${item}-${i}`}
            onClick={() => {
              if (dragMoved.current) {
                dragMoved.current = false
                return
              }
              const el = ref.current
              if (!el) return
              el.scrollTo({ top: i * WHEEL_ITEM_H, behavior: 'smooth' })
              setActive(i)
              onChange(i)
            }}
            style={{
              height: WHEEL_ITEM_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: selected ? 20 : 17,
              fontWeight: selected ? 600 : 400,
              color:
                dist === 0
                  ? INK
                  : dist === 1
                    ? 'rgba(26,39,86,0.38)'
                    : 'rgba(26,39,86,0.22)',
              userSelect: 'none',
              transition: 'color .12s ease, font-size .12s ease',
            }}
          >
            {item}
          </div>
        )
      })}
      <div style={{ height: WHEEL_PAD, flexShrink: 0 }} />
    </div>
  )
}

function BirthdayStep({
  day,
  month,
  year,
  onDay,
  onMonth,
  onYear,
  onNext,
}: {
  day: number
  month: number
  year: number
  onDay: (n: number) => void
  onMonth: (n: number) => void
  onYear: (n: number) => void
  onNext: () => void
}) {
  const years = Array.from({ length: 80 }, (_, i) => 2010 - i)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const dayIndex = day - 1
  const yearIndex = Math.max(0, years.indexOf(year))

  return (
    <ScreenShell>
      <div
        style={{
          padding: '110px 24px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 36,
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
            textAlign: 'center',
            maxWidth: 300,
            lineHeight: 1.25,
          }}
        >
          And when’s your birthday?
        </h1>

        <div style={{ position: 'relative', width: '100%', maxWidth: 340 }}>
          <div
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              height: WHEEL_ITEM_H,
              borderRadius: 999,
              background: '#fff',
              boxShadow: '0 8px 22px rgba(26,39,86,0.1)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              gap: 4,
            }}
          >
            <DateWheel
              items={days}
              index={dayIndex}
              onChange={(i) => onDay(days[i])}
              flex={0.7}
            />
            <DateWheel
              items={MONTHS}
              index={month}
              onChange={onMonth}
              flex={1.4}
            />
            <DateWheel
              items={years}
              index={yearIndex}
              onChange={(i) => onYear(years[i])}
              flex={0.9}
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto', marginBottom: 56 }}>
          <NextButton onClick={onNext} />
        </div>
      </div>
    </ScreenShell>
  )
}

function InterestsStep({
  selected,
  onToggle,
  onNext,
}: {
  selected: string[]
  onToggle: (id: string) => void
  onNext: () => void
}) {
  return (
    <ScreenShell>
      <div
        style={{
          padding: '100px 28px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
            textAlign: 'center',
          }}
        >
          What are your interests?
        </h1>
        <p
          style={{
            margin: '12px 0 28px',
            fontSize: 15,
            lineHeight: 1.4,
            color: MUTED,
            textAlign: 'center',
            maxWidth: 300,
          }}
        >
          Pick three or more, Yoshi will share exciting things with you on them
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            width: '100%',
          }}
        >
          {INTERESTS.map((item) => {
            const on = selected.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                style={{
                  height: 56,
                  borderRadius: 999,
                  border: on
                    ? '1.5px solid rgba(26,39,86,0.35)'
                    : '1px solid rgba(26,39,86,0.1)',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px',
                  cursor: 'pointer',
                  boxShadow: on
                    ? '0 6px 18px rgba(26,39,86,0.12)'
                    : '0 2px 8px rgba(26,39,86,0.04)',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: on ? 'rgba(26,39,86,0.08)' : '#F0EEF4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    flex: 'none',
                  }}
                >
                  {item.emoji}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: INK,
                  }}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 'auto', marginBottom: 56 }}>
          <NextButton onClick={onNext} disabled={selected.length < 3} />
        </div>
      </div>
    </ScreenShell>
  )
}

function RelationshipStep({
  index,
  onIndexChange,
  onNext,
}: {
  index: number
  onIndexChange: (i: number) => void
  onNext: () => void
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const dragMoved = useRef(false)

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    el.scrollTo({ left: index * REL_STRIDE })
  }, [])

  const snap = () => {
    const el = railRef.current
    if (!el) return
    const next = Math.max(
      0,
      Math.min(RELATIONSHIP_TYPES.length - 1, Math.round(el.scrollLeft / REL_STRIDE)),
    )
    el.scrollTo({ left: next * REL_STRIDE, behavior: 'smooth' })
    onIndexChange(next)
  }

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const next = Math.max(
      0,
      Math.min(
        RELATIONSHIP_TYPES.length - 1,
        Math.round(e.currentTarget.scrollLeft / REL_STRIDE),
      ),
    )
    if (next !== index) onIndexChange(next)
  }

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const el = railRef.current
    if (!el) return
    drag.current = { x: e.clientX, left: el.scrollLeft }
    dragMoved.current = false
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

  return (
    <ScreenShell>
      <div
        style={{
          paddingTop: 100,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            margin: '0 32px 28px',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          What relationship type are you looking for?
        </h1>

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
            gap: 16,
            padding: '0 calc(50% - 136px)',
            cursor: 'grab',
            userSelect: 'none',
            flex: 1,
            maxHeight: 420,
          }}
        >
          {RELATIONSHIP_TYPES.map((type) => (
            <div
              key={type.id}
              style={{
                flex: 'none',
                width: 272,
                height: '100%',
                maxHeight: 400,
                borderRadius: 28,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 16px 40px rgba(26,39,86,0.16)',
              }}
            >
              <img
                src={type.image}
                alt={type.title}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: '48px 20px 22px',
                  background:
                    'linear-gradient(180deg, transparent, rgba(0,0,0,0.72))',
                  color: '#fff',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 600 }}>{type.title}</div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 15,
                    opacity: 0.9,
                    fontWeight: 400,
                  }}
                >
                  {type.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '28px 0 56px',
          }}
        >
          <NextButton onClick={onNext} />
        </div>
      </div>
    </ScreenShell>
  )
}

function MeetStep({
  image,
  onChosen,
}: {
  image: string
  onChosen: () => void
}) {
  const [progress, setProgress] = useState(0)
  const holding = useRef(false)
  const raf = useRef(0)
  const start = useRef(0)

  const stopHold = () => {
    holding.current = false
    cancelAnimationFrame(raf.current)
    setProgress(0)
  }

  const tick = (t: number) => {
    if (!holding.current) return
    if (!start.current) start.current = t
    const p = Math.min(1, (t - start.current) / 900)
    setProgress(p)
    if (p >= 1) {
      holding.current = false
      onChosen()
      return
    }
    raf.current = requestAnimationFrame(tick)
  }

  const startHold = () => {
    holding.current = true
    start.current = 0
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const warmth = 72 + Math.round(progress * 18)

  return (
    <ScreenShell>
      <div
        style={{
          padding: '88px 28px 0',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
            textAlign: 'center',
          }}
        >
          Meet your Yoshi
        </h1>
        <p
          style={{
            margin: '10px 0 22px',
            fontSize: 15,
            color: MUTED,
            textAlign: 'center',
          }}
        >
          Each Yoshi is unique. Swipe to wake them
        </p>

        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 320,
            aspectRatio: '1',
            borderRadius: 28,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(26,39,86,0.14)',
          }}
        >
          <img
            src={image}
            alt="Your Yoshi"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: 24,
              bottom: 24,
              width: 3,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.35)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: `${12 + progress * 50}%`,
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#E85A4A',
                boxShadow: '0 0 0 3px rgba(232,90,74,0.35)',
              }}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              right: 14,
              bottom: 14,
              width: 78,
              height: 78,
              borderRadius: '50%',
              background: 'rgba(20,20,28,0.72)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: `inset 0 0 0 3px rgba(232,90,74,${0.35 + progress * 0.5})`,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
              {warmth}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Warmth</div>
          </div>
        </div>

        <div
          style={{
            width: '70%',
            height: 6,
            borderRadius: 999,
            background: 'rgba(26,39,86,0.1)',
            marginTop: 18,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${8 + progress * 92}%`,
              height: '100%',
              borderRadius: 999,
              background: '#E85A4A',
              transition: holding.current ? 'none' : 'width .2s ease',
            }}
          />
        </div>

        <div
          style={{
            marginTop: 'auto',
            marginBottom: 48,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            width: '100%',
          }}
        >
          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            style={{
              width: '100%',
              maxWidth: 300,
              height: 58,
              borderRadius: 999,
              border: 'none',
              background: '#fff',
              boxShadow: '0 10px 28px rgba(26,39,86,0.12)',
              fontSize: 17,
              fontWeight: 600,
              color: INK,
              cursor: 'pointer',
              fontFamily: 'inherit',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: `rgba(232,90,74,${progress * 0.18})`,
              }}
            />
            <span style={{ position: 'relative' }}>Hold to choose</span>
          </button>
          <button
            type="button"
            onClick={onChosen}
            style={{
              border: 'none',
              background: 'transparent',
              color: MUTED,
              fontSize: 15,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Add your photo instead
          </button>
        </div>
      </div>
    </ScreenShell>
  )
}

function NameYoshiStep({
  image,
  value,
  onChange,
  onNext,
}: {
  image: string
  value: string
  onChange: (v: string) => void
  onNext: () => void
}) {
  return (
    <ScreenShell>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: 340,
            borderRadius: '0 0 28px 28px',
            overflow: 'hidden',
            flex: 'none',
          }}
        >
          <img
            src={image}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: '50% 20%',
              display: 'block',
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '28px 32px 0',
            gap: 22,
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) onNext()
            }}
            placeholder="Name your Yoshi"
            style={{
              width: '100%',
              height: 58,
              borderRadius: 999,
              border: '1px solid rgba(26,39,86,0.08)',
              background: '#fff',
              boxShadow: '0 8px 24px rgba(26,39,86,0.08)',
              padding: '0 24px',
              fontSize: 18,
              fontWeight: 500,
              color: INK,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          />
          <NextButton onClick={onNext} disabled={!value.trim()} />
        </div>
      </div>
    </ScreenShell>
  )
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('splash')
  const [userName, setUserName] = useState('')
  const [day, setDay] = useState(1)
  const [month, setMonth] = useState(0)
  const [year, setYear] = useState(2000)
  const [interests, setInterests] = useState<string[]>([])
  const [relIndex, setRelIndex] = useState(0)
  const [yoshiName, setYoshiName] = useState('')

  const relationship = RELATIONSHIP_TYPES[relIndex]
  const showKeyboard = step === 'name' || step === 'nameYoshi'

  const finish = () => {
    if (!yoshiName.trim()) return
    // Prototype: always land on Fuibo Flower regardless of onboarding choices
    const fuibo = getYoshi(DEFAULT_YOSHI_ID)
    onComplete({
      userName: userName.trim(),
      yoshiId: fuibo.id,
      yoshiName: fuibo.name,
      yoshiImage: fuibo.image,
      relationshipId: relationship.id,
    })
  }

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  let body: ReactNode = null
  if (step === 'splash') {
    body = <SplashStep onDone={() => setStep('welcome')} />
  } else if (step === 'welcome') {
    body = <WelcomeStep onContinue={() => setStep('name')} />
  } else if (step === 'name') {
    body = (
      <NameStep
        value={userName}
        onChange={setUserName}
        onNext={() => {
          if (userName.trim()) setStep('birthday')
        }}
      />
    )
  } else if (step === 'birthday') {
    body = (
      <BirthdayStep
        day={day}
        month={month}
        year={year}
        onDay={setDay}
        onMonth={setMonth}
        onYear={setYear}
        onNext={() => setStep('interests')}
      />
    )
  } else if (step === 'interests') {
    body = (
      <InterestsStep
        selected={interests}
        onToggle={toggleInterest}
        onNext={() => {
          if (interests.length >= 3) setStep('relationship')
        }}
      />
    )
  } else if (step === 'relationship') {
    body = (
      <RelationshipStep
        index={relIndex}
        onIndexChange={setRelIndex}
        onNext={() => setStep('meet')}
      />
    )
  } else if (step === 'meet') {
    body = (
      <MeetStep
        image={relationship.image}
        onChosen={() => setStep('nameYoshi')}
      />
    )
  } else {
    body = (
      <NameYoshiStep
        image={relationship.image}
        value={yoshiName}
        onChange={setYoshiName}
        onNext={finish}
      />
    )
  }

  return <IOSDevice keyboard={showKeyboard}>{body}</IOSDevice>
}
