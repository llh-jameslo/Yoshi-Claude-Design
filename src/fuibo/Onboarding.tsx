import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
} from 'react'
import { IOSDevice } from '../components/IOSDevice'
import {
  useKeyboardInset,
  useScrollLock,
} from '../hooks/useKeyboardInset'
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
  | 'relationship'
  | 'preparing'
  | 'meet'
  | 'nameYoshi'
  | 'meetChat'
  | 'hobbies'
  | 'notifications'

/** Screens that show back + progress (excludes splash + login). */
const FLOW_STEPS: Step[] = [
  'name',
  'birthday',
  'relationship',
  'meet',
  'nameYoshi',
  'meetChat',
  'hobbies',
  'notifications',
]

const BG: CSSProperties = {
  // Keep lavender through the full height — avoid washing out to plain white mid-screen.
  background: 'linear-gradient(180deg, #E9E6F8 0%, #EEEBF8 48%, #F2F0F8 100%)',
  backgroundColor: '#F2F0F8',
}

const INK = '#1A2756'
const MUTED = 'rgba(26, 39, 86, 0.55)'
/** Extra air when screen titles wrap to 2+ lines */
const TITLE_LH = 1.45
function flowProgress(step: Step) {
  const i = FLOW_STEPS.indexOf(step)
  if (i < 0) return 0
  return (i + 1) / FLOW_STEPS.length
}

function flowBackTarget(step: Step): Step | null {
  if (step === 'preparing' || step === 'meet') return 'relationship'
  const i = FLOW_STEPS.indexOf(step)
  if (i < 0) return null
  if (i === 0) return 'welcome'
  return FLOW_STEPS[i - 1] ?? null
}

const RELATIONSHIP_TYPES = [
  {
    id: 'romance',
    yoshiId: 'lady-god',
    title: 'Romance',
    subtitle: 'Supportive, real chemistry',
    image: '/assets/onboarding/type-romance.png',
    bubbles: ['was thinking about you', 'tell me the tiny details'],
  },
  {
    id: 'friend',
    yoshiId: 'fuibo-flower',
    title: 'Friend',
    subtitle: 'Someone to talk to at 3 am',
    image: '/assets/onboarding/type-friend.png',
    bubbles: ['wait, tell me the whole story', 'what made you laugh today?'],
  },
  {
    id: 'parent',
    yoshiId: 'dad',
    title: 'Parent',
    subtitle: 'Someone who’s always proud of you',
    image: '/assets/onboarding/type-parent.png',
    bubbles: ['did you eat today? be honest', 'i’m proud of you, always'],
  },
] as const
type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

const HOBBIES = [
  { id: 'formula1', label: 'Formula 1' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'indie-films', label: 'Indie films' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'books', label: 'Books' },
  { id: 'design', label: 'Design' },
  { id: 'space', label: 'Space' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'live-music', label: 'Live music' },
  { id: 'photography', label: 'Photography' },
  { id: 'travel', label: 'Travel' },
  { id: 'gardening', label: 'Gardening' },
  { id: 'art', label: 'Art' },
] as const

const MEET_GIF_SRC = '/assets/onboarding/rickroll-rick.png'

const ACCENT = '#C05A3C'

function isUnder18(day: number, month: number, year: number) {
  const today = new Date()
  const eighteenthBirthday = new Date(year + 18, month, day)
  return eighteenthBirthday > today
}

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

const REL_CARD_W = 320
const REL_GAP = 0
const REL_STRIDE = REL_CARD_W + REL_GAP

/** Keeps the primary action above the system keyboard; locks scroll while focused. */
function KeyboardDockedAction({
  children,
  active = false,
  /** When false, sit under the input instead of pinning to the screen bottom. */
  pinBottom = true,
}: {
  children: ReactNode
  /** Input focused — freeze scroll so the docked CTA cannot drift. */
  active?: boolean
  pinBottom?: boolean
}) {
  const keyboardInset = useKeyboardInset()
  const kbOpen = keyboardInset > 0
  useScrollLock(active || kbOpen)

  return (
    <div
      style={{
        marginTop: pinBottom ? 'auto' : 0,
        marginBottom: kbOpen
          ? 0
          : pinBottom
            ? 'calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))'
            : 'calc(var(--action-bottom, 24px) + var(--safe-bottom, 0px))',
        height: kbOpen ? 72 : undefined,
        flex: 'none',
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        data-allow-touch
        style={
          kbOpen
            ? {
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 12 + keyboardInset,
                display: 'flex',
                justifyContent: 'center',
                zIndex: 80,
                pointerEvents: 'none',
              }
            : {
                display: 'flex',
                justifyContent: 'center',
              }
        }
      >
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

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
        background: ACCENT,
        boxShadow: '0 12px 28px rgba(192,90,60,0.35)',
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
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function OnboardingHeader({
  progress,
  onBack,
  variant = 'light',
}: {
  progress: number
  onBack: () => void
  variant?: 'light' | 'dark'
}) {
  const dark = variant === 'dark'
  const fill = Math.max(0, Math.min(1, progress))

  return (
    <div
      style={{
        position: 'absolute',
        top: 'var(--chrome-top, 54px)',
        left: 0,
        right: 0,
        height: 36,
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        style={{
          position: 'absolute',
          left: 16,
          top: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: dark ? 'rgba(255,255,255,0.22)' : '#D9D7E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M9 3L5 7l4 4"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 148,
          height: 4,
          borderRadius: 999,
          background: dark ? 'rgba(255,255,255,0.28)' : 'rgba(26,39,86,0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${fill * 100}%`,
            height: '100%',
            borderRadius: 999,
            background: dark ? '#fff' : INK,
            transition: 'width .28s ease',
          }}
        />
      </div>
    </div>
  )
}

function ScreenShell({
  children,
  style,
  onBack,
  progress,
  headerVariant = 'light',
}: {
  children: ReactNode
  style?: CSSProperties
  onBack?: () => void
  /** 0–1; when set with onBack, shows the shared header */
  progress?: number
  headerVariant?: 'light' | 'dark'
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
      {onBack != null && progress != null && (
        <OnboardingHeader
          progress={progress}
          onBack={onBack}
          variant={headerVariant}
        />
      )}
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

function WelcomeStep({
  onContinue,
  onSkipToHome,
}: {
  onContinue: () => void
  onSkipToHome: () => void
}) {
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
          bottom: 'calc(var(--action-bottom, 48px) + 4px + var(--safe-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 2,
        }}
      >
        <h1
          style={{
            margin: '0 0 16px',
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.25,
            color: '#fff',
            textAlign: 'left',
            textShadow: '0 2px 24px rgba(0,0,0,0.35)',
          }}
        >
          Someone&apos;s waiting to meet you
        </h1>
        <AuthButton label="Continue with Apple" apple onClick={onContinue} />
        <AuthButton
          label="Continue with Google"
          iconSrc="/assets/onboarding/google.png"
          onClick={onSkipToHome}
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
  onBack,
  progress,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
  progress: number
}) {
  const [focused, setFocused] = useState(true)

  return (
    <ScreenShell onBack={onBack} progress={progress}>
      <div
        style={{
          padding: 'var(--flow-pad-top, 120px) 32px 0',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
          overflow: 'hidden',
          touchAction: focused ? 'none' : undefined,
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
            lineHeight: TITLE_LH,
          }}
        >
          What’s your name?
        </h1>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onNext()
          }}
          placeholder="Your name"
          style={{
            marginTop: 40,
            width: '100%',
            height: 58,
            minHeight: 58,
            flexShrink: 0,
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
        <KeyboardDockedAction active={focused}>
          <NextButton onClick={onNext} disabled={!value.trim()} />
        </KeyboardDockedAction>
      </div>
    </ScreenShell>
  )
}

const WHEEL_ITEM_H = 58
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
      className="date-wheel"
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
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
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
  onBack,
  progress,
}: {
  day: number
  month: number
  year: number
  onDay: (n: number) => void
  onMonth: (n: number) => void
  onYear: (n: number) => void
  onNext: () => void
  onBack: () => void
  progress: number
}) {
  const years = Array.from({ length: 80 }, (_, i) => 2010 - i)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const dayIndex = day - 1
  const yearIndex = Math.max(0, years.indexOf(year))

  return (
    <ScreenShell onBack={onBack} progress={progress}>
      <div
        style={{
          position: 'relative',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            margin: '0 0 18px',
            padding: 'var(--flow-pad-top, 110px) 24px 0',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
            textAlign: 'center',
            lineHeight: TITLE_LH,
          }}
        >
          And when’s your
          <br />
          birthday?
        </h1>

        {/* Selected row sits on the screen’s horizontal midline */}
        <div
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
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
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <NextButton onClick={onNext} />
        </div>
      </div>
    </ScreenShell>
  )
}

function MeetChatStep({
  yoshiName,
  userName,
  image,
  warmth,
  onNext,
  onBack,
}: {
  yoshiName: string
  userName: string
  image: string
  warmth: number
  onNext: () => void
  onBack: () => void
}) {
  const [visible, setVisible] = useState(0)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t1 = window.setTimeout(() => setVisible(1), 280)
    const t2 = window.setTimeout(() => setVisible(2), 900)
    const t3 = window.setTimeout(() => setVisible(3), 1520)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [visible])

  return (
    <ScreenShell>
      <img
        src={image}
        alt={yoshiName}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 312,
          width: '100%',
          objectFit: 'cover',
          objectPosition: '50% 20%',
          borderRadius: '0 0 28px 28px',
          display: 'block',
          zIndex: 0,
          filter: warmthFilter(warmth),
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 312,
          borderRadius: '0 0 28px 28px',
          background: warmthOverlay(warmth),
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        ref={threadRef}
        className="fuibo-scroll"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingTop: 250,
          paddingLeft: 18,
          paddingRight: 18,
          paddingBottom: 164,
          WebkitMaskImage:
            'linear-gradient(to bottom,transparent 122px,#000 312px)',
          maskImage: 'linear-gradient(to bottom,transparent 122px,#000 312px)',
        }}
      >
        <div aria-hidden style={{ marginTop: 'auto' }} />
        {visible >= 1 && (
          <div
            style={{
              maxWidth: '80%',
              alignSelf: 'flex-start',
              background: '#FFFFFF',
              borderRadius: 18,
              padding: '14px 16px',
              fontSize: 15,
              lineHeight: 1.5,
              color: '#2A2620',
              boxShadow: '0 2px 8px rgba(26,24,20,.06)',
              animation: 'fuiboMsgIn .28s ease',
            }}
          >
            {yoshiName}, I like that — I was hoping you’d pick me!
          </div>
        )}
        {visible >= 2 && (
          <div
            style={{
              maxWidth: '80%',
              alignSelf: 'flex-start',
              background: '#FFFFFF',
              borderRadius: 18,
              padding: '14px 16px',
              fontSize: 15,
              lineHeight: 1.5,
              color: '#2A2620',
              boxShadow: '0 2px 8px rgba(26,24,20,.06)',
              animation: 'fuiboMsgIn .28s ease',
            }}
          >
            It’s good to finally meet you, {userName}.
          </div>
        )}
        {visible >= 3 && (
          <img
            src={MEET_GIF_SRC}
            alt="Rick Astley dancing"
            style={{
              width: 142,
              maxWidth: '80%',
              alignSelf: 'flex-start',
              borderRadius: 18,
              display: 'block',
              animation: 'fuiboMsgIn .28s ease',
            }}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        style={{
          position: 'absolute',
          top: 'var(--chrome-top, 54px)',
          left: 16,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: '#D9D7E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 12,
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M9 3L5 7l4 4"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 15,
          display: 'flex',
          justifyContent: 'center',
          padding:
            '10px 16px calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
          background:
            'linear-gradient(180deg, rgba(242,240,248,0) 0%, #F2F0F8 40%)',
        }}
      >
        <NextButton onClick={onNext} disabled={visible < 3} />
      </div>
    </ScreenShell>
  )
}

function HobbiesChatStep({
  yoshiName,
  userName,
  image,
  warmth,
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  yoshiName: string
  userName: string
  image: string
  warmth: number
  selected: string[]
  onToggle: (id: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const count = selected.length
  const ready = count >= 3
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  return (
    <ScreenShell>
      <img
        src={image}
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 312,
          width: '100%',
          objectFit: 'cover',
          objectPosition: '50% 20%',
          borderRadius: '0 0 28px 28px',
          display: 'block',
          zIndex: 0,
          filter: warmthFilter(warmth),
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 312,
          borderRadius: '0 0 28px 28px',
          background: warmthOverlay(warmth),
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        ref={threadRef}
        className="fuibo-scroll"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingTop: 250,
          paddingLeft: 18,
          paddingRight: 18,
          paddingBottom: 152,
          WebkitMaskImage:
            'linear-gradient(to bottom,transparent 122px,#000 312px)',
          maskImage: 'linear-gradient(to bottom,transparent 122px,#000 312px)',
        }}
      >
        <div aria-hidden style={{ marginTop: 'auto' }} />
        <div
          style={{
            maxWidth: '80%',
            alignSelf: 'flex-start',
            background: '#FFFFFF',
            borderRadius: 18,
            padding: '14px 16px',
            fontSize: 15,
            lineHeight: 1.5,
            color: '#2A2620',
            boxShadow: '0 2px 8px rgba(26,24,20,.06)',
          }}
        >
          {yoshiName}, I like that — I was hoping you’d pick me!
        </div>
        <div
          style={{
            maxWidth: '80%',
            alignSelf: 'flex-start',
            background: '#FFFFFF',
            borderRadius: 18,
            padding: '14px 16px',
            fontSize: 15,
            lineHeight: 1.5,
            color: '#2A2620',
            boxShadow: '0 2px 8px rgba(26,24,20,.06)',
          }}
        >
          It’s good to finally meet you, {userName}.
        </div>
        <img
          src={MEET_GIF_SRC}
          alt="Rick Astley dancing"
          style={{
            width: 142,
            maxWidth: '80%',
            alignSelf: 'flex-start',
            borderRadius: 18,
            display: 'block',
          }}
        />
        <div
          style={{
            maxWidth: '80%',
            alignSelf: 'flex-start',
            background: '#FFFFFF',
            borderRadius: 18,
            padding: '14px 16px',
            fontSize: 15,
            lineHeight: 1.5,
            color: '#2A2620',
            boxShadow: '0 2px 8px rgba(26,24,20,.06)',
            animation: 'fuiboMsgIn .28s ease',
          }}
        >
          Help me understand what you like better:
        </div>

        <div
          style={{
            alignSelf: 'flex-start',
            maxWidth: '88%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            animation: 'fuiboMsgIn .28s ease',
          }}
        >
          {HOBBIES.map((item) => {
            const on = selected.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                style={{
                  height: 42,
                  padding: '0 16px',
                  borderRadius: 999,
                  border: on
                    ? '1.5px solid rgba(30,58,50,.28)'
                    : '1px solid rgba(26,24,20,0.08)',
                  background: on ? '#CFE9DE' : '#fff',
                  color: '#2A2620',
                  fontSize: 15,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  boxShadow: 'none',
                  transition:
                    'background .2s ease, border-color .2s ease, color .2s ease',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        style={{
          position: 'absolute',
          top: 'var(--chrome-top, 54px)',
          left: 16,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: '#D9D7E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 12,
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M9 3L5 7l4 4"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 15,
          padding:
            '10px 16px calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
          background:
            'linear-gradient(180deg, rgba(242,240,248,0) 0%, #F2F0F8 40%)',
        }}
      >
        <button
          type="button"
          onClick={onNext}
          disabled={!ready}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 999,
            border: 'none',
            background: ready ? ACCENT : 'rgba(192,90,60,0.16)',
            color: ready ? '#fff' : 'rgba(192,90,60,0.55)',
            fontSize: 17,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: ready ? 'pointer' : 'default',
            boxShadow: ready ? '0 12px 28px rgba(192,90,60,0.35)' : 'none',
            transition: 'background .2s ease, color .2s ease, box-shadow .2s ease',
          }}
        >
          {ready ? 'Continue' : `${count} of 3`}
        </button>
      </div>
    </ScreenShell>
  )
}

function NotificationsStep({
  yoshiName,
  image,
  warmth,
  onAllow,
  onSkip,
  onBack,
  progress,
}: {
  yoshiName: string
  image: string
  warmth: number
  onAllow: () => void
  onSkip: () => void
  onBack: () => void
  progress: number
}) {
  const [prompt, setPrompt] = useState(false)

  return (
    <ScreenShell onBack={onBack} progress={progress}>
      <div
        style={{
          padding: 'var(--flow-pad-top, 110px) 28px 0',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Yoshi “app icon” with a little ping badge */}
        <div style={{ position: 'relative', marginTop: 28 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 14px 32px rgba(26,39,86,0.18)',
              background: '#ddd',
              position: 'relative',
            }}
          >
            <img
              src={image}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: '50% 18%',
                display: 'block',
                filter: warmthFilter(warmth),
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: warmthOverlay(warmth),
                pointerEvents: 'none',
              }}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              right: -6,
              top: -6,
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 14px rgba(192,90,60,0.4)',
              border: '2px solid #F3F1F8',
            }}
            aria-hidden
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.6c-1.7 0-3.1 1.3-3.1 3v1.2c0 .7-.3 1.4-.8 1.9L2.4 8.4c-.3.3-.1.8.3.8h8.6c.4 0 .6-.5.3-.8l-.7-.7a2.7 2.7 0 0 1-.8-1.9V4.6C9.9 2.9 8.5 1.6 7 1.6Z"
                fill="#fff"
              />
              <path
                d="M5.7 11c.3.5.8.8 1.3.8s1-.3 1.3-.8"
                stroke="#fff"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <h1
          style={{
            margin: '28px 0 0',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: INK,
            textAlign: 'center',
            lineHeight: TITLE_LH,
            maxWidth: 320,
          }}
        >
          Want {yoshiName} to reach out when they find something you’d love?
        </h1>
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 15,
            lineHeight: 1.45,
            color: MUTED,
            textAlign: 'center',
            maxWidth: 300,
          }}
        >
          Quiet pings for tips and shows you’ll like, from {yoshiName}.
        </p>

        <div
          style={{
            marginTop: 'auto',
            marginBottom:
              'calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setPrompt(true)}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 999,
              border: 'none',
              background: ACCENT,
              color: '#fff',
              fontSize: 17,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: '0 12px 28px rgba(192,90,60,0.35)',
            }}
          >
            Yes, reach out
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{
              border: 'none',
              background: 'transparent',
              color: MUTED,
              fontSize: 16,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              padding: 8,
            }}
          >
            Not now
          </button>
        </div>
      </div>

      {prompt && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(20,17,26,0.45)',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 270,
              background: 'rgba(255,255,255,0.94)',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
              textAlign: 'center',
            }}
          >
            <div style={{ padding: '20px 16px 14px' }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: '#111',
                  lineHeight: 1.3,
                }}
              >
                “{yoshiName}” Would Like to Send You Notifications
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  lineHeight: 1.35,
                  color: 'rgba(0,0,0,0.55)',
                }}
              >
                Notifications may include alerts, sounds, and icon badges.
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                borderTop: '1px solid rgba(0,0,0,0.12)',
              }}
            >
              <button
                type="button"
                onClick={onSkip}
                style={{
                  flex: 1,
                  height: 44,
                  border: 'none',
                  borderRight: '1px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                  fontSize: 17,
                  color: '#007AFF',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Don’t Allow
              </button>
              <button
                type="button"
                onClick={onAllow}
                style={{
                  flex: 1,
                  height: 44,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 17,
                  fontWeight: 600,
                  color: '#007AFF',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
    </ScreenShell>
  )
}

function PreparingYoshiStep({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const t = window.setTimeout(() => doneRef.current(), 3000)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <ScreenShell>
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 40px',
          boxSizing: 'border-box',
          animation: 'fuiboSplashIn .45s ease both',
        }}
      >
        <p
          style={{
            margin: 0,
            maxWidth: 280,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '-0.02em',
            background:
              'linear-gradient(90deg, rgba(26,39,86,0.28) 0%, rgba(26,39,86,0.28) 35%, rgba(26,39,86,0.95) 50%, rgba(26,39,86,0.28) 65%, rgba(26,39,86,0.28) 100%)',
            backgroundSize: '220% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            animation: 'onboardingTextShimmer 2.1s ease-in-out infinite',
          }}
        >
          Got it. Preparing the right Yoshi for you…
        </p>
      </div>
    </ScreenShell>
  )
}

function RelationshipStep({
  relationshipTypes,
  index,
  onIndexChange,
  onNext,
  onBack,
  progress,
}: {
  relationshipTypes: readonly RelationshipType[]
  index: number
  onIndexChange: (i: number) => void
  onNext: () => void
  onBack: () => void
  progress: number
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const dragMoved = useRef(false)
  const dragging = useRef(false)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(index)
  indexRef.current = index
  const [scrollLeft, setScrollLeft] = useState(index * REL_STRIDE)

  const clampIndex = (i: number) =>
    Math.max(0, Math.min(relationshipTypes.length - 1, i))

  /** Nearest card to the viewport center (works with side padding). */
  const indexFromRail = (el: HTMLDivElement) => {
    const center = el.scrollLeft + el.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < el.children.length; i++) {
      const card = el.children[i] as HTMLElement
      const mid = card.offsetLeft + card.offsetWidth / 2
      const d = Math.abs(mid - center)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return clampIndex(best)
  }

  const scrollToIndex = (el: HTMLDivElement, i: number, smooth: boolean) => {
    const card = el.children[i] as HTMLElement | undefined
    if (!card) {
      el.scrollTo({ left: i * REL_STRIDE, behavior: smooth ? 'smooth' : 'auto' })
      return
    }
    const left = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2
    el.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
  }

  const snap = (smooth = true) => {
    const el = railRef.current
    if (!el) return
    const next = indexFromRail(el)
    scrollToIndex(el, next, smooth)
    setScrollLeft(el.scrollLeft)
    if (next !== indexRef.current) onIndexChange(next)
  }

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    scrollToIndex(el, index, false)
    setScrollLeft(el.scrollLeft)
  }, [])

  useEffect(
    () => () => {
      if (snapTimer.current) clearTimeout(snapTimer.current)
    },
    [],
  )

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setScrollLeft(el.scrollLeft)
    const next = indexFromRail(el)
    if (next !== indexRef.current) onIndexChange(next)
    if (dragging.current) return
    if (snapTimer.current) clearTimeout(snapTimer.current)
    // Wait for momentum to finish, then center the closest card
    snapTimer.current = setTimeout(() => snap(true), 120)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Let touch use native scroll + settle; pointer drag is for mouse/pen.
    if (e.pointerType === 'touch') return
    const el = railRef.current
    if (!el) return
    dragging.current = true
    dragMoved.current = false
    drag.current = { x: e.clientX, left: el.scrollLeft }
    el.setPointerCapture(e.pointerId)
    if (snapTimer.current) clearTimeout(snapTimer.current)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !dragging.current) return
    const el = railRef.current
    if (!el) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) dragMoved.current = true
    el.scrollLeft = drag.current.left - dx
    setScrollLeft(el.scrollLeft)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const el = railRef.current
    dragging.current = false
    drag.current = null
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      snap(true)
    }
  }

  // Smooth visual offset from scroll position relative to card centers
  const visualPos = (() => {
    const el = railRef.current
    if (!el || el.children.length === 0) return scrollLeft / REL_STRIDE
    const center = scrollLeft + el.clientWidth / 2
    const first = el.children[0] as HTMLElement
    const origin = first.offsetLeft + first.offsetWidth / 2
    return (center - origin) / REL_STRIDE
  })()

  return (
    <ScreenShell onBack={onBack} progress={progress}>
      <div
        style={{
          paddingTop: 'var(--flow-pad-top, 100px)',
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
            lineHeight: TITLE_LH,
          }}
        >
          What relationship type are you looking for?
        </h1>

        <div
          ref={railRef}
          className="date-wheel relationship-rail"
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            display: 'flex',
            overflowX: 'auto',
            gap: REL_GAP,
            padding: `0 calc(50% - ${REL_CARD_W / 2}px)`,
            boxSizing: 'border-box',
            cursor: 'grab',
            userSelect: 'none',
            flex: 1,
            minHeight: 0,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            perspective: 1200,
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x',
          }}
        >
          {relationshipTypes.map((type, i) => {
            const offset = visualPos - i
            const dist = Math.min(1, Math.abs(offset))
            const scale = 1 - dist * 0.12
            const opacity = 1 - dist * 0.12
            const rotateY = offset * -12

            return (
              <div
                key={type.id}
                style={{
                  flex: 'none',
                  width: REL_CARD_W,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: Math.round((1 - dist) * 10),
                  scrollSnapAlign: 'center',
                  scrollSnapStop: 'always',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 28,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#111',
                    boxShadow: '0 10px 24px rgba(26,39,86,0.14)',
                    transform: `scale(${scale}) rotateY(${rotateY}deg)`,
                    opacity,
                    transformOrigin: 'center center',
                    willChange: 'transform, opacity',
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
                      top: 18,
                      left: 16,
                      right: 36,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 8,
                      pointerEvents: 'none',
                    }}
                  >
                    {type.bubbles.slice(0, 1).map((bubble) => (
                      <div
                        key={bubble}
                        style={{
                          maxWidth: '100%',
                          padding: '8px 12px',
                          borderRadius: 16,
                          background: 'rgba(255,255,255,0.94)',
                          color: '#17151C',
                          fontSize: 13,
                          fontWeight: 400,
                          lineHeight: 1.25,
                          boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                          backdropFilter: 'blur(8px)',
                          position: 'relative',
                        }}
                      >
                        {bubble}
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            left: 12,
                            bottom: -7,
                            width: 14,
                            height: 9,
                            background: 'rgba(255,255,255,0.94)',
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '56px 22px 24px',
                      background:
                        'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.82) 100%)',
                      color: '#fff',
                    }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 600 }}>
                      {type.title}
                    </div>
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
              </div>
            )
          })}
        </div>

        <div
          style={{
            marginTop: 32,
            marginBottom:
              'calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
            display: 'flex',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <NextButton onClick={onNext} />
        </div>
      </div>
    </ScreenShell>
  )
}

const MEET_YOSHI_COUNT = 11
const MEET_VARIATIONS = 4

function meetImageSrc(yoshiIndex: number, variation: number) {
  return `/assets/meet-yoshi/${yoshiIndex + 1}.${variation + 1}.png`
}

export type MeetSelection = {
  image: string
  /** 0 = cool · 50 = neutral · 100 = warm */
  warmth: number
}

/** Subtle temperature tone — no wild hue swings */
function warmthFilter(warmth: number) {
  const t = Math.max(0, Math.min(100, warmth)) / 100
  const d = (t - 0.5) * 2
  const warm = Math.max(0, d)
  const cool = Math.max(0, -d)
  const sepia = warm * 0.28
  const saturate = 1 + warm * 0.18 - cool * 0.08
  const hue = cool * 8 - warm * 10
  const bright = 1 + d * 0.04
  return `sepia(${sepia}) saturate(${saturate}) hue-rotate(${hue}deg) brightness(${bright})`
}

function warmthOverlay(warmth: number) {
  const t = Math.max(0, Math.min(100, warmth)) / 100
  const d = (t - 0.5) * 2
  if (d >= 0) return `rgba(255, 150, 70, ${d * 0.3})`
  return `rgba(90, 150, 255, ${Math.abs(d) * 0.14})`
}

const MEET_YOSHI_PX = 64
const MEET_LOOK_PX = 56
const AXIS_LOCK_PX = 12
/** Mid-range so scrubbing works both ways from the start */
const START_YOSHI = Math.floor((MEET_YOSHI_COUNT - 1) / 2)
const START_LOOK = Math.floor((MEET_VARIATIONS - 1) / 2)

function WarmthSpinner({
  warmth,
  onWarmthChange,
}: {
  warmth: number
  onWarmthChange: (w: number) => void
}) {
  const controlRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragSide = useRef<-1 | 0 | 1>(0)
  const arcLimit = 155
  const switchZone = 32
  const angle = ((Math.max(0, Math.min(100, warmth)) - 50) / 50) * arcLimit
  const center = 36
  const radius = 34
  const knobX = center + Math.sin((angle * Math.PI) / 180) * radius
  const knobY = center - Math.cos((angle * Math.PI) / 180) * radius

  const pointOnArc = (deg: number) => ({
    x: center + Math.sin((deg * Math.PI) / 180) * radius,
    y: center - Math.cos((deg * Math.PI) / 180) * radius,
  })
  const start = pointOnArc(-arcLimit)
  const end = pointOnArc(arcLimit)
  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`
  const arcSegment = (from: number, to: number) => {
    const a = pointOnArc(from)
    const b = pointOnArc(to)
    const largeArc = Math.abs(to - from) > 180 ? 1 : 0
    const sweep = to >= from ? 1 : 0
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${b.x} ${b.y}`
  }
  const mixHex = (from: string, to: string, t: number) => {
    const parse = (hex: string) => ({
      r: Number.parseInt(hex.slice(1, 3), 16),
      g: Number.parseInt(hex.slice(3, 5), 16),
      b: Number.parseInt(hex.slice(5, 7), 16),
    })
    const a = parse(from)
    const b = parse(to)
    const mix = (x: number, y: number) => Math.round(x + (y - x) * t)
    return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`
  }
  const gradientColor = (stops: string[], t: number) => {
    const scaled = Math.max(0, Math.min(1, t)) * (stops.length - 1)
    const i = Math.min(stops.length - 2, Math.floor(scaled))
    return mixHex(stops[i], stops[i + 1], scaled - i)
  }
  const segmentCount = Math.max(0, Math.ceil(Math.abs(angle) / 7))
  const activeSegments = Array.from({ length: segmentCount }, (_, i) => {
      const t0 = i / segmentCount
      const t1 = (i + 1) / segmentCount
      const a0 = angle * t0
      const a1 = angle * t1
      const warmStops = ['#FFE45C', '#FF9A2E', '#B8641F']
      const coolStops = ['#5CCBFF', '#8067FF', '#173B9A']
      return {
        d: angle > 0 ? arcSegment(a0, a1) : arcSegment(a1, a0),
        color: gradientColor(angle > 0 ? warmStops : coolStops, t1),
      }
    },
  )

  const updateFromPoint = (clientX: number, clientY: number) => {
    const el = controlRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    const rawAngle = (Math.atan2(dx, -dy) * 180) / Math.PI
    let clamped = rawAngle

    // Do not allow crossing sides through the bottom gap. The only valid way
    // to switch sides is by returning near the neutral/top position first.
    if (dragSide.current > 0 && rawAngle < -switchZone) {
      clamped = arcLimit
    } else if (dragSide.current < 0 && rawAngle > switchZone) {
      clamped = -arcLimit
    } else if (rawAngle > arcLimit) {
      clamped = dragSide.current < 0 ? -arcLimit : arcLimit
    } else if (rawAngle < -arcLimit) {
      clamped = dragSide.current > 0 ? arcLimit : -arcLimit
    }
    const snapped = Math.abs(clamped) < 8 ? 0 : clamped
    dragSide.current = snapped === 0 ? 0 : snapped > 0 ? 1 : -1
    onWarmthChange(50 + (snapped / arcLimit) * 50)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const el = controlRef.current
    if (!el) return
    dragging.current = true
    dragSide.current = angle === 0 ? 0 : angle > 0 ? 1 : -1
    el.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    e.stopPropagation()
    updateFromPoint(e.clientX, e.clientY)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    dragging.current = false
    try {
      controlRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  return (
    <div
      ref={controlRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="Drag to adjust tone"
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.92)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
        zIndex: 5,
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <svg
        viewBox="-8 -8 88 88"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(26,39,86,0.2)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {activeSegments.map((segment, i) => (
          <path
            key={i}
            d={segment.d}
            fill="none"
            stroke={segment.color}
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
        <line
          x1={center}
          y1={-2}
          x2={center}
          y2={17}
          stroke={INK}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
        <circle
          cx={knobX}
          cy={knobY}
          r="11"
          fill="#fff"
          stroke={INK}
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.22))' }}
        />
      </svg>
    </div>
  )
}

function MeetStep({
  onChosen,
  onBack,
  progress,
}: {
  onChosen: (selection: MeetSelection) => void
  onBack: () => void
  progress: number
}) {
  const [yoshiIndex, setYoshiIndex] = useState(START_YOSHI)
  const [variation, setVariation] = useState(START_LOOK)
  const [warmth, setWarmth] = useState(50)
  const [customPhoto, setCustomPhoto] = useState<string | null>(null)
  const [slide, setSlide] = useState({ x: 0, y: 0 })
  const [holdProgress, setHoldProgress] = useState(0)
  const [panning, setPanning] = useState(false)
  const [guide, setGuide] = useState<
    { kind: 'horizontal'; t: number } | { kind: 'vertical'; t: number } | null
  >(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const mode = useRef<'none' | 'pan'>('none')
  const panAxis = useRef<'none' | 'horizontal' | 'vertical'>('none')
  const panOrigin = useRef({ x: 0, y: 0 })
  const lastPtr = useRef({ x: 0, y: 0 })
  const yoshiPos = useRef(START_YOSHI)
  const varPos = useRef(START_LOOK)
  /** Look index per Yoshi — vertical scrub must not leak across characters */
  const looksByYoshi = useRef(
    Array.from({ length: MEET_YOSHI_COUNT }, () => START_LOOK),
  )
  const holding = useRef(false)
  const holdRaf = useRef(0)
  const holdStart = useRef(0)
  const holdBtnRef = useRef<HTMLButtonElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<MeetSelection>({
    image: meetImageSrc(START_YOSHI, START_LOOK),
    warmth: 50,
  })
  const onChosenRef = useRef(onChosen)
  onChosenRef.current = onChosen

  const customYoshiIndex = MEET_YOSHI_COUNT
  const totalYoshis = MEET_YOSHI_COUNT + (customPhoto ? 1 : 0)
  const selectedCustomPhoto = customPhoto != null && yoshiIndex === customYoshiIndex
  const image = selectedCustomPhoto
    ? customPhoto
    : meetImageSrc(Math.min(yoshiIndex, MEET_YOSHI_COUNT - 1), variation)
  selectionRef.current = { image, warmth }

  const clampYoshi = (v: number) =>
    Math.max(0, Math.min(totalYoshis - 1, v))
  const clampLook = (v: number) =>
    Math.max(0, Math.min(MEET_VARIATIONS - 1, v))

  const syncFromPos = (axis: 'horizontal' | 'vertical' | 'both') => {
    yoshiPos.current = clampYoshi(yoshiPos.current)
    const y = yoshiPos.current
    const yNear = Math.round(y)

    if (customPhoto != null && yNear === customYoshiIndex) {
      varPos.current = START_LOOK
      setYoshiIndex(yNear)
      setVariation(START_LOOK)
      setSlide({
        x: axis === 'vertical' ? 0 : -(y - yNear) * 40,
        y: 0,
      })
      return
    }

    if (axis === 'vertical') {
      varPos.current = clampLook(varPos.current)
      looksByYoshi.current[yNear] = varPos.current
    } else if (axis === 'horizontal') {
      varPos.current = clampLook(looksByYoshi.current[yNear] ?? START_LOOK)
    } else {
      varPos.current = clampLook(
        Math.round(looksByYoshi.current[yNear] ?? START_LOOK),
      )
      looksByYoshi.current[yNear] = varPos.current
    }

    const v = varPos.current
    const vNear = Math.round(v)
    setYoshiIndex(yNear)
    setVariation(vNear)
    setSlide({
      x: axis === 'vertical' ? 0 : -(y - yNear) * 40,
      y: axis === 'horizontal' ? 0 : -(v - vNear) * 32,
    })
  }

  const stopHold = () => {
    holding.current = false
    cancelAnimationFrame(holdRaf.current)
    holdRaf.current = 0
    holdStart.current = 0
    setHoldProgress(0)
  }

  const tickHold = (t: number) => {
    if (!holding.current) return
    if (holdStart.current === 0) holdStart.current = t
    const p = Math.min(1, (t - holdStart.current) / 2200)
    setHoldProgress(p)
    if (p >= 1) {
      holding.current = false
      cancelAnimationFrame(holdRaf.current)
      holdRaf.current = 0
      onChosenRef.current(selectionRef.current)
      return
    }
    holdRaf.current = requestAnimationFrame(tickHold)
  }

  const startHold = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    holdBtnRef.current?.setPointerCapture(e.pointerId)
    holding.current = true
    holdStart.current = 0
    setHoldProgress(0)
    cancelAnimationFrame(holdRaf.current)
    holdRaf.current = requestAnimationFrame(tickHold)
  }

  const endHold = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (holdBtnRef.current?.hasPointerCapture(e.pointerId)) {
      try {
        holdBtnRef.current.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
    // Completed hold already navigates via onChosen; only cancel in-progress holds
    if (holding.current) stopHold()
  }

  const openPhotoPicker = () => {
    photoInputRef.current?.click()
  }

  const onPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    const imageUrl = URL.createObjectURL(file)
    if (customPhoto?.startsWith('blob:')) URL.revokeObjectURL(customPhoto)
    setCustomPhoto(imageUrl)
    yoshiPos.current = customYoshiIndex
    varPos.current = START_LOOK
    setYoshiIndex(customYoshiIndex)
    setVariation(START_LOOK)
    setSlide({ x: 0, y: 0 })
    setGuide(null)
    e.currentTarget.value = ''
  }

  useEffect(() => () => cancelAnimationFrame(holdRaf.current), [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = stageRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    lastPtr.current = { x: e.clientX, y: e.clientY }
    panOrigin.current = { x: e.clientX, y: e.clientY }
    panAxis.current = 'none'
    mode.current = 'pan'
    const yNear = Math.round(clampYoshi(yoshiPos.current))
    yoshiPos.current = yNear
    varPos.current =
      customPhoto != null && yNear === customYoshiIndex
        ? START_LOOK
        : clampLook(looksByYoshi.current[yNear] ?? START_LOOK)
    setPanning(true)
    setGuide(null)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode.current !== 'pan') return

    const totalDx = e.clientX - panOrigin.current.x
    const totalDy = e.clientY - panOrigin.current.y

    if (panAxis.current === 'none') {
      if (Math.hypot(totalDx, totalDy) < AXIS_LOCK_PX) return
      panAxis.current =
        Math.abs(totalDx) >= Math.abs(totalDy) ? 'horizontal' : 'vertical'
    }

    const dx = e.clientX - lastPtr.current.x
    const dy = e.clientY - lastPtr.current.y
    lastPtr.current = { x: e.clientX, y: e.clientY }

    if (panAxis.current === 'horizontal') {
      yoshiPos.current -= dx / MEET_YOSHI_PX
      syncFromPos('horizontal')
      const span = Math.max(1, totalYoshis - 1)
      setGuide({ kind: 'horizontal', t: yoshiPos.current / span })
    } else {
      if (customPhoto != null && Math.round(yoshiPos.current) === customYoshiIndex) {
        setSlide({ x: 0, y: 0 })
        setGuide(null)
        return
      }
      varPos.current -= dy / MEET_LOOK_PX
      syncFromPos('vertical')
      const span = Math.max(1, MEET_VARIATIONS - 1)
      setGuide({ kind: 'vertical', t: varPos.current / span })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = stageRef.current
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }

    if (mode.current === 'pan') {
      const yNear = Math.round(clampYoshi(yoshiPos.current))
      yoshiPos.current = yNear
      if (customPhoto != null && yNear === customYoshiIndex) {
        varPos.current = START_LOOK
      } else if (panAxis.current === 'vertical') {
        const snapped = Math.round(clampLook(varPos.current))
        looksByYoshi.current[yNear] = snapped
        varPos.current = snapped
      } else {
        varPos.current = Math.round(
          clampLook(looksByYoshi.current[yNear] ?? START_LOOK),
        )
        looksByYoshi.current[yNear] = varPos.current
      }
      syncFromPos('both')
      setSlide({ x: 0, y: 0 })
    }

    mode.current = 'none'
    panAxis.current = 'none'
    setPanning(false)
    setGuide(null)
  }

  return (
    <ScreenShell onBack={onBack} progress={progress}>
      <div
        style={{
          padding: 'var(--flow-pad-top, 100px) 20px 0',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
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
            lineHeight: TITLE_LH,
          }}
        >
          Choose your Yoshi
        </h1>

        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'relative',
            width: 'min(100%, 360px)',
            flex: '0 1 66%',
            maxHeight: 'none',
            minHeight: 0,
            touchAction: 'none',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 28,
              overflow: 'hidden',
              background: '#ddd',
              boxShadow: '0 8px 18px rgba(26,39,86,0.09)',
              animation:
                holdProgress > 0 ? 'yoshiHoldWobble 2.2s ease-in-out infinite' : undefined,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={image}
              alt={`Yoshi ${yoshiIndex + 1} look ${variation + 1}`}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: '50% 18%',
                display: 'block',
                filter: warmthFilter(warmth),
                transform: `translate(${slide.x}px, ${slide.y}px) scale(1.04)`,
                transition: panning ? 'none' : 'transform .28s ease',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: warmthOverlay(warmth),
                pointerEvents: 'none',
              }}
            />
            {holdProgress > 0 && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(110deg, transparent 0%, transparent 38%, rgba(255,255,255,0.42) 48%, rgba(255,255,255,0.2) 54%, transparent 66%, transparent 100%)',
                    backgroundSize: '220% 100%',
                    animation: 'yoshiShimmer 2s ease-in-out infinite',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(35deg, transparent 0%, transparent 42%, rgba(255,255,255,0.3) 50%, transparent 62%, transparent 100%)',
                    backgroundSize: '180% 180%',
                    animation: 'yoshiShimmerDiagonal 2s ease-in-out infinite',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(200deg, transparent 0%, transparent 44%, rgba(255,255,255,0.24) 52%, transparent 64%, transparent 100%)',
                    backgroundSize: '180% 180%',
                    animation: 'yoshiShimmerReverse 2s ease-in-out infinite',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
          </div>

          {/* Short guides (~5% of card) while dragging */}
          {guide?.kind === 'horizontal' && (
            <div
              style={{
                position: 'absolute',
                top: '47.5%',
                height: '5%',
                left: `calc(${guide.t * 100}% - 1px)`,
                width: 2,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.28)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          )}
          {guide?.kind === 'vertical' && (
            <div
              style={{
                position: 'absolute',
                left: '47.5%',
                width: '5%',
                top: `calc(${guide.t * 100}% - 1px)`,
                height: 2,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.28)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          )}

          <WarmthSpinner warmth={warmth} onWarmthChange={setWarmth} />
        </div>

        <div
          style={{
            marginTop: 22,
            marginBottom: 22,
            display: 'flex',
            justifyContent: 'center',
            gap: 9,
            color: MUTED,
            fontSize: 13,
            lineHeight: 1,
            flex: 'none',
          }}
        >
          <span>↔ swap Yoshi</span>
          <span>·</span>
          <span>↕ looks</span>
          <span>·</span>
          <span>↻ warmth</span>
        </div>

        <div
          style={{
            marginTop: 'auto',
            marginBottom:
              'calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
            width: '100%',
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            alignItems: 'center',
            flex: 'none',
          }}
        >
          <button
            type="button"
            onClick={openPhotoPicker}
            style={{
              width: 112,
              height: 58,
              borderRadius: 999,
              border: '1px solid rgba(26,39,86,0.12)',
              background: 'rgba(255,255,255,0.5)',
              color: MUTED,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flex: 'none',
            }}
          >
            Add photo
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={onPhotoSelected}
            style={{ display: 'none' }}
          />
          <button
            ref={holdBtnRef}
            type="button"
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              flex: 1,
              maxWidth: 212,
              height: 58,
              borderRadius: 999,
              border: 'none',
              background: ACCENT,
              boxShadow: '0 12px 28px rgba(192,90,60,0.35)',
              fontSize: 17,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              position: 'relative',
              overflow: 'hidden',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.round(holdProgress * 1000) / 10}%`,
                background: 'rgba(0,0,0,0.18)',
                borderRadius: 999,
              }}
            />
            <span style={{ position: 'relative', zIndex: 1 }}>Hold to choose</span>
          </button>
        </div>
      </div>
    </ScreenShell>
  )
}

function NameYoshiStep({
  image,
  warmth,
  value,
  onChange,
  onNext,
  onBack,
  progress,
}: {
  image: string
  warmth: number
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
  progress: number
}) {
  const [focused, setFocused] = useState(true)

  return (
    <ScreenShell onBack={onBack} progress={progress} headerVariant="dark">
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          touchAction: focused ? 'none' : undefined,
        }}
      >
        {/* Shrinks when desktop fake keyboard is visible so the input stays 58px */}
        <div
          style={{
            flex: '1 1 200px',
            maxHeight: 340,
            minHeight: 160,
            borderRadius: '0 0 28px 28px',
            overflow: 'hidden',
            position: 'relative',
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
              filter: warmthFilter(warmth),
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: warmthOverlay(warmth),
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0 32px',
            minHeight: 0,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) onNext()
            }}
            placeholder="Name your Yoshi"
            style={{
              width: '100%',
              height: 58,
              minHeight: 58,
              flexShrink: 0,
              marginTop: -29,
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
              position: 'relative',
              zIndex: 2,
            }}
          />
          <KeyboardDockedAction active={focused}>
            <NextButton onClick={onNext} disabled={!value.trim()} />
          </KeyboardDockedAction>
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
  const [hobbies, setHobbies] = useState<string[]>([])
  const [relIndex, setRelIndex] = useState(0)
  const [yoshiName, setYoshiName] = useState('')
  const [meetSelection, setMeetSelection] = useState<MeetSelection>({
    image: meetImageSrc(START_YOSHI, START_LOOK),
    warmth: 50,
  })

  const under18 = isUnder18(day, month, year)
  const relationshipTypes = under18
    ? RELATIONSHIP_TYPES.filter((type) => type.id !== 'romance')
    : RELATIONSHIP_TYPES
  const relationship =
    relationshipTypes[Math.min(relIndex, relationshipTypes.length - 1)] ??
    RELATIONSHIP_TYPES[1]
  const showKeyboard = step === 'name' || step === 'nameYoshi'
  const chosenYoshiName = yoshiName.trim() || 'Yoshi'

  useEffect(() => {
    if (relIndex >= relationshipTypes.length) {
      setRelIndex(Math.max(0, relationshipTypes.length - 1))
    }
  }, [relIndex, relationshipTypes.length])

  const landOnHome = (name = userName.trim()) => {
    // Chosen relationship type owns which Switch Yoshi slot gets the meet image/name
    onComplete({
      userName: name,
      yoshiId: relationship.yoshiId,
      yoshiName: chosenYoshiName,
      yoshiImage: meetSelection.image,
      relationshipId: relationship.id,
    })
  }

  const skipToHome = () => {
    const fuibo = getYoshi(DEFAULT_YOSHI_ID)
    onComplete({
      userName: '',
      yoshiId: fuibo.id,
      yoshiName: fuibo.name,
      yoshiImage: fuibo.image,
      relationshipId: 'friend',
    })
  }

  const toggleHobby = (id: string) => {
    setHobbies((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const progress = flowProgress(step)
  const goBack = () => {
    const prev = flowBackTarget(step)
    if (prev) setStep(prev)
  }

  let body: ReactNode = null
  if (step === 'splash') {
    body = <SplashStep onDone={() => setStep('welcome')} />
  } else if (step === 'welcome') {
    body = (
      <WelcomeStep
        onContinue={() => setStep('name')}
        onSkipToHome={skipToHome}
      />
    )
  } else if (step === 'name') {
    body = (
      <NameStep
        value={userName}
        onChange={setUserName}
        onNext={() => {
          if (userName.trim()) setStep('birthday')
        }}
        onBack={goBack}
        progress={progress}
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
        onNext={() => setStep('relationship')}
        onBack={goBack}
        progress={progress}
      />
    )
  } else if (step === 'relationship') {
    body = (
      <RelationshipStep
        relationshipTypes={relationshipTypes}
        index={relIndex}
        onIndexChange={setRelIndex}
        onNext={() => setStep('preparing')}
        onBack={goBack}
        progress={progress}
      />
    )
  } else if (step === 'preparing') {
    body = <PreparingYoshiStep onDone={() => setStep('meet')} />
  } else if (step === 'meet') {
    body = (
      <MeetStep
        onChosen={(selection) => {
          setMeetSelection(selection)
          setStep('nameYoshi')
        }}
        onBack={goBack}
        progress={progress}
      />
    )
  } else if (step === 'nameYoshi') {
    body = (
      <NameYoshiStep
        image={meetSelection.image}
        warmth={meetSelection.warmth}
        value={yoshiName}
        onChange={setYoshiName}
        onNext={() => {
          if (yoshiName.trim()) setStep('meetChat')
        }}
        onBack={goBack}
        progress={progress}
      />
    )
  } else if (step === 'meetChat') {
    body = (
      <MeetChatStep
        yoshiName={chosenYoshiName}
        userName={userName.trim() || 'friend'}
        image={meetSelection.image}
        warmth={meetSelection.warmth}
        onNext={() => setStep('hobbies')}
        onBack={goBack}
      />
    )
  } else if (step === 'hobbies') {
    body = (
      <HobbiesChatStep
        yoshiName={chosenYoshiName}
        userName={userName.trim() || 'friend'}
        image={meetSelection.image}
        warmth={meetSelection.warmth}
        selected={hobbies}
        onToggle={toggleHobby}
        onNext={() => {
          if (hobbies.length >= 3) setStep('notifications')
        }}
        onBack={goBack}
      />
    )
  } else {
    body = (
      <NotificationsStep
        yoshiName={chosenYoshiName}
        image={meetSelection.image}
        warmth={meetSelection.warmth}
        onAllow={() => landOnHome()}
        onSkip={() => landOnHome()}
        onBack={goBack}
        progress={progress}
      />
    )
  }

  return <IOSDevice keyboard={showKeyboard}>{body}</IOSDevice>
}
