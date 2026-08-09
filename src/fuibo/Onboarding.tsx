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
import { useCompactViewport } from '../hooks/useCompactViewport'
import { DEFAULT_YOSHI_ID, getYoshi } from './yoshis'

export type OnboardingResult = {
  userName: string
  yoshiId: string
  yoshiName: string
  yoshiImage: string
  relationshipId: string
}

type OnboardingMode = 'full' | 'addYoshi'

type Props = {
  onComplete: (result: OnboardingResult) => void
  /** Full first-run vs. create another Yoshi from Switch */
  mode?: OnboardingMode
  /** Prior profile used when adding another Yoshi */
  seed?: OnboardingResult
  /** Leave add-Yoshi flow without changing the current Yoshi */
  onCancel?: () => void
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

/** Shorter create-another path: relationship → meet → name → intro chat */
const ADD_FLOW_STEPS: Step[] = [
  'relationship',
  'meet',
  'nameYoshi',
  'meetChat',
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
function flowStepsFor(mode: OnboardingMode) {
  return mode === 'addYoshi' ? ADD_FLOW_STEPS : FLOW_STEPS
}

function flowProgress(step: Step, mode: OnboardingMode = 'full') {
  const steps = flowStepsFor(mode)
  const i = steps.indexOf(step)
  if (i < 0) return 0
  return (i + 1) / steps.length
}

function flowBackTarget(
  step: Step,
  mode: OnboardingMode = 'full',
): Step | null {
  if (step === 'preparing' || step === 'meet') return 'relationship'
  const steps = flowStepsFor(mode)
  const i = steps.indexOf(step)
  if (i < 0) return null
  if (i === 0) return mode === 'addYoshi' ? null : 'welcome'
  return steps[i - 1] ?? null
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
  { id: 'cooking', label: 'Cooking' },
  { id: 'movies', label: 'Movies' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'books', label: 'Books' },
  { id: 'design', label: 'Design' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'music', label: 'Music' },
  { id: 'anime', label: 'Anime' },
  { id: 'photography', label: 'Photography' },
  { id: 'travel', label: 'Travel' },
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
        <div data-keep-keyboard style={{ width: '100%', marginTop: 40 }}>
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
        </div>
        <KeyboardDockedAction active={focused}>
          <div data-keep-keyboard>
            <NextButton onClick={onNext} disabled={!value.trim()} />
          </div>
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
  const compact = useCompactViewport()
  const count = selected.length
  const ready = count >= 3
  const threadRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const [chipsH, setChipsH] = useState(220)

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [selected.length, compact, chipsH])

  useEffect(() => {
    if (!compact) return
    const el = chipsRef.current
    if (!el) return
    const measure = () => setChipsH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact])

  const hobbyChips = (
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
  )

  const ctaPad =
    '10px 16px calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))'
  // Continue bar ≈ 10 + 56 + action-bottom + safe
  const mobileCtaH =
    'calc(66px + var(--action-bottom, 14px) + var(--safe-bottom, 0px))'

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
          // Mobile: leave room for pinned chips + Continue so chips never need a scroll
          bottom: compact ? `calc(${mobileCtaH} + ${chipsH}px)` : 0,
          overflowY: 'auto',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingTop: 250,
          paddingLeft: 18,
          paddingRight: 18,
          // Desktop: clear Continue with a modest gap
          paddingBottom: compact
            ? 12
            : 'calc(84px + var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
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

        {/* Desktop: chips stay in the scroll thread */}
        {!compact ? hobbyChips : null}
      </div>

      {/* Mobile: pin chips just above Continue — chat is pushed up above them */}
      {compact ? (
        <div
          ref={chipsRef}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: mobileCtaH,
            zIndex: 14,
            padding: '4px 18px 6px',
            background:
              'linear-gradient(180deg, rgba(242,240,248,0) 0%, #F2F0F8 28%)',
          }}
        >
          {hobbyChips}
        </div>
      ) : null}

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
          padding: ctaPad,
          background: compact
            ? '#F2F0F8'
            : 'linear-gradient(180deg, rgba(242,240,248,0) 0%, #F2F0F8 40%)',
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
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            minHeight: 0,
            paddingTop: 28,
            paddingBottom: 12,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: INK,
              textAlign: 'center',
              lineHeight: 1.2,
              maxWidth: 300,
            }}
          >
            Stay close with {yoshiName}
          </h1>

          {/* Phone + notification illustration */}
          <div
            aria-hidden
            style={{
              width: 220,
              height: 220,
              marginTop: 24,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 50% 42%, #E4E0F4 0%, #D9D4EE 55%, #D2CDEA 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              animation: 'fuiboSplashIn .55s ease both',
            }}
          >
            <div
              style={{
                width: 92,
                height: 148,
                borderRadius: 18,
                background: 'linear-gradient(165deg, #3A4A7A 0%, #1A2756 100%)',
                boxShadow: '0 16px 28px rgba(26,39,86,0.18)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 36,
                  height: 5,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.28)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '22px 10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.14)',
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '42%',
                transform: 'translate(-50%, -50%)',
                width: 168,
                height: 56,
                borderRadius: 16,
                background: '#FFFFFF',
                boxShadow: '0 10px 28px rgba(26,39,86,0.16)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 14px',
                animation: 'notifCardFloat 2.8s ease-in-out infinite',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    height: 8,
                    width: '72%',
                    borderRadius: 999,
                    background: 'rgba(26,39,86,0.14)',
                    marginBottom: 7,
                  }}
                />
                <div
                  style={{
                    height: 8,
                    width: '48%',
                    borderRadius: 999,
                    background: 'rgba(26,39,86,0.08)',
                  }}
                />
              </div>
            </div>
          </div>

          <p
            style={{
              margin: '24px 0 0',
              fontSize: 15,
              lineHeight: 1.5,
              color: MUTED,
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            Get a nudge when {yoshiName} wants to check in — so you’re never too
            far apart.
          </p>
        </div>

        <div
          style={{
            marginBottom:
              'calc(var(--action-bottom, 48px) + var(--safe-bottom, 0px))',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            flexShrink: 0,
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
            Turn on notifications
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{
              border: 'none',
              background: 'transparent',
              color: INK,
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              padding: 10,
            }}
          >
            Skip
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
            animation: 'fuiboScrimIn .2s ease both',
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
              animation: 'fuiboSheetIn .28s ease both',
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
  const compact = useCompactViewport()
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
    // Mobile: settle after touch momentum. Desktop snaps only on pointer-up
    // so drag can slide freely between cards.
    if (!compact) return
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => snap(true), 120)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Touch uses native scroll + settle; mouse/pen drag is desktop free-slide.
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
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            // Mobile: CSS snap for touch. Desktop: free drag, JS snap on release.
            ...(compact
              ? {
                  scrollSnapType: 'x proximity' as const,
                  touchAction: 'pan-x' as const,
                }
              : {
                  scrollSnapType: 'none' as const,
                  touchAction: 'none' as const,
                }),
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
                  ...(compact
                    ? {
                        scrollSnapAlign: 'center' as const,
                      }
                    : {}),
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
                          boxShadow:
                            '0 4px 14px rgba(0,0,0,0.28), 0 1px 3px rgba(0,0,0,0.18)',
                          backdropFilter: 'blur(8px)',
                          position: 'relative',
                          textShadow: '0 1px 0 rgba(255,255,255,0.4)',
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
                            filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.22))',
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
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 600,
                        textShadow: '0 2px 10px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.4)',
                      }}
                    >
                      {type.title}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 15,
                        opacity: 0.9,
                        fontWeight: 400,
                        textShadow: '0 1px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.35)',
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

/** Presentation gender for each on-disk slot (1.x → index 0). */
const MEET_YOSHI_GENDER = [
  'f', // 1 teal braids
  'f', // 2 cyber / pink
  'm', // 3 gold sunglasses
  'f', // 4 bob / looking up
  'f', // 5 hannya
  'f', // 6 race car
  'm', // 7 curly patchwork (default start)
  'm', // 8 sunflower
  'm', // 9 red hair
  'f', // 10 glasses / starlight
  'm', // 11 gas mask
] as const

/**
 * Scrub order: alternate M/F, with the default Yoshi centered in the rail.
 * Display index (0..n-1) → on-disk slot index (0 → file 1.x).
 */
function buildAlternatingMeetOrder(centerAsset: number) {
  const males: number[] = []
  const females: number[] = []
  for (let i = 0; i < MEET_YOSHI_COUNT; i++) {
    if (i === centerAsset) continue
    if (MEET_YOSHI_GENDER[i] === 'm') males.push(i)
    else females.push(i)
  }

  const startGender = MEET_YOSHI_GENDER[centerAsset]
  const same = startGender === 'm' ? males : females
  const other = startGender === 'm' ? females : males
  const seq = [centerAsset]

  let a = 0
  let b = 0
  while (a < same.length || b < other.length) {
    if (b < other.length) seq.push(other[b++])
    if (a < same.length) seq.push(same[a++])
  }

  // Rotate so the default asset lands in the middle of the scrub range
  const center = Math.floor((MEET_YOSHI_COUNT - 1) / 2)
  const n = seq.length
  return Array.from({ length: n }, (_, i) => seq[(i - center + n) % n])
}

/** Curly patchwork portrait set on disk (file 7.x → index 6) — default at center. */
const MEET_START_ASSET = 6
const MEET_YOSHI_ORDER = (() => {
  const order = buildAlternatingMeetOrder(MEET_START_ASSET)
  // Swap bob / looking-up (4.x) with hannya / red demon (5.x)
  const bob = order.indexOf(3)
  const demon = order.indexOf(4)
  if (bob >= 0 && demon >= 0) {
    ;[order[bob], order[demon]] = [order[demon], order[bob]]
  }
  return order
})()

function meetAssetIndex(displayIndex: number) {
  const clamped = Math.max(0, Math.min(MEET_YOSHI_COUNT - 1, displayIndex))
  return MEET_YOSHI_ORDER[clamped] ?? clamped
}

function meetImageSrc(yoshiIndex: number, variation: number) {
  const asset = meetAssetIndex(yoshiIndex)
  return `/assets/meet-yoshi/${asset + 1}.${variation + 1}.png`
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
/** Center card in the alternating gender scrub (curly male). */
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

function MeetHintArrow({
  dir,
  animation,
}: {
  dir: 'left' | 'right' | 'up' | 'down'
  animation: string
}) {
  const rotate =
    dir === 'right' ? 0 : dir === 'left' ? 180 : dir === 'down' ? 90 : -90
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        animation,
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        style={{ transform: `rotate(${rotate}deg)` }}
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

function MeetStep({
  onChosen,
  onBack,
  progress,
}: {
  onChosen: (selection: MeetSelection) => void
  onBack: () => void
  progress: number
}) {
  const compact = useCompactViewport()
  const [yoshiIndex, setYoshiIndex] = useState(START_YOSHI)
  const [variation, setVariation] = useState(START_LOOK)
  const [warmth, setWarmth] = useState(50)
  const [customPhoto, setCustomPhoto] = useState<string | null>(null)
  const [slide, setSlide] = useState({ x: 0, y: 0 })
  /** Mobile: which frame is on screen while dragging (floor — avoids round-flip twitch). */
  const [showFrame, setShowFrame] = useState({ y: START_YOSHI, v: START_LOOK })
  const [holdProgress, setHoldProgress] = useState(0)
  const [panning, setPanning] = useState(false)
  const [showDragHint, setShowDragHint] = useState(true)
  const [chooseFlash, setChooseFlash] = useState(false)
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
  const chooseFlashTimer = useRef(0)
  const selectionRef = useRef<MeetSelection>({
    image: meetImageSrc(START_YOSHI, START_LOOK),
    warmth: 50,
  })
  const onChosenRef = useRef(onChosen)
  onChosenRef.current = onChosen

  const dismissDragHint = () => setShowDragHint(false)

  const customYoshiIndex = MEET_YOSHI_COUNT
  const totalYoshis = MEET_YOSHI_COUNT + (customPhoto ? 1 : 0)
  const selectedCustomPhoto = customPhoto != null && yoshiIndex === customYoshiIndex
  // Mobile: hold the committed frame until drag crosses threshold (no per-frame slide)
  const frameY = compact ? showFrame.y : yoshiIndex
  const frameV = compact ? showFrame.v : variation
  const showingCustom =
    customPhoto != null && frameY === customYoshiIndex
  const image = showingCustom
    ? customPhoto
    : meetImageSrc(Math.min(frameY, MEET_YOSHI_COUNT - 1), frameV)
  const selectedImage = selectedCustomPhoto
    ? customPhoto
    : meetImageSrc(Math.min(yoshiIndex, MEET_YOSHI_COUNT - 1), variation)
  selectionRef.current = { image: selectedImage, warmth }

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
      if (compact) {
        setShowFrame({ y: yNear, v: START_LOOK })
        setSlide({ x: 0, y: 0 })
      } else {
        setSlide({
          x: axis === 'vertical' ? 0 : -(y - yNear) * 40,
          y: 0,
        })
      }
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

    if (compact) {
      // Image stays put; only swap when rounded index changes (drag past midpoint).
      setShowFrame({ y: yNear, v: vNear })
      setSlide({ x: 0, y: 0 })
    } else {
      setSlide({
        x: axis === 'vertical' ? 0 : -(y - yNear) * 40,
        y: axis === 'horizontal' ? 0 : -(v - vNear) * 32,
      })
    }
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
      dismissDragHint()
      setHoldProgress(0)
      setChooseFlash(true)
      window.clearTimeout(chooseFlashTimer.current)
      chooseFlashTimer.current = window.setTimeout(() => {
        onChosenRef.current(selectionRef.current)
      }, 2000)
      return
    }
    holdRaf.current = requestAnimationFrame(tickHold)
  }

  const startHold = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (chooseFlash) return
    dismissDragHint()
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
    setShowFrame({ y: customYoshiIndex, v: START_LOOK })
    setSlide({ x: 0, y: 0 })
    setGuide(null)
    e.currentTarget.value = ''
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(holdRaf.current)
      window.clearTimeout(chooseFlashTimer.current)
    },
    [],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = stageRef.current
    if (!el || chooseFlash) return
    dismissDragHint()
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
    if (compact) {
      setShowFrame({ y: yNear, v: Math.round(varPos.current) })
      setSlide({ x: 0, y: 0 })
    }
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

    // Mobile: shorter horizontal span (~2 swipes across all Yoshis); image still locked.
    const yoshiPx = compact ? 50 : MEET_YOSHI_PX
    const lookPx = compact ? 72 : MEET_LOOK_PX

    if (panAxis.current === 'horizontal') {
      yoshiPos.current -= dx / yoshiPx
      syncFromPos('horizontal')
      const span = Math.max(1, totalYoshis - 1)
      setGuide({ kind: 'horizontal', t: yoshiPos.current / span })
    } else {
      if (customPhoto != null && Math.round(yoshiPos.current) === customYoshiIndex) {
        setSlide({ x: 0, y: 0 })
        setGuide(null)
        return
      }
      varPos.current -= dy / lookPx
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
      if (compact) {
        setShowFrame({ y: yoshiPos.current, v: varPos.current })
      }
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
            flex: '0 1 72%',
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
              alt={`Yoshi ${frameY + 1} look ${frameV + 1}`}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: '50% 18%',
                display: 'block',
                filter: warmthFilter(warmth),
                // Mobile: no drag parallax — image stays locked until threshold swap
                transform: compact
                  ? 'scale(1.04)'
                  : `translate(${slide.x}px, ${slide.y}px) scale(1.04)`,
                transition:
                  compact || panning ? 'none' : 'transform .28s ease',
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

          {showDragHint && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 8,
                borderRadius: 28,
                padding: 0,
                background: 'rgba(20,17,26,0.42)',
                animation: 'meetHintScrimIn .35s ease both',
                boxSizing: 'border-box',
                color: '#fff',
                // Let the first touch start a drag — stage dismisses the hint on pointerdown.
                pointerEvents: 'none',
              }}
            >
              {/* Up / down — left, vertically centered, copy left-aligned */}
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  textAlign: 'left',
                }}
              >
                <MeetHintArrow
                  dir="up"
                  animation="meetHintArrowYUp 1.1s ease-in-out infinite"
                />
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
                    Change looks
                  </div>
                </div>
                <MeetHintArrow
                  dir="down"
                  animation="meetHintArrowY 1.1s ease-in-out infinite"
                />
              </div>

              {/* Left / right — near bottom, centered */}
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  right: 16,
                  bottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                }}
              >
                <MeetHintArrow
                  dir="left"
                  animation="meetHintArrowXLeft 1.1s ease-in-out infinite"
                />
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Drag left / right
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      opacity: 0.75,
                    }}
                  >
                    Swap Yoshi
                  </div>
                </div>
                <MeetHintArrow
                  dir="right"
                  animation="meetHintArrowX 1.1s ease-in-out infinite"
                />
              </div>
            </div>
          )}
        </div>

        <div aria-hidden style={{ height: 24, flex: 'none' }} />

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
              border: `1.5px solid ${INK}`,
              background: '#FFFFFF',
              color: INK,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flex: 'none',
              boxShadow: '0 6px 16px rgba(26,39,86,0.10)',
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

      {chooseFlash && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            pointerEvents: 'auto',
            background: '#FFFFFF',
            animation: 'meetChooseFlash 2s ease-out both',
          }}
        />
      )}
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
          animation: 'meetNameEnter .7s cubic-bezier(0.22, 1, 0.36, 1) both',
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
          <div
            data-keep-keyboard
            style={{
              width: '100%',
              marginTop: -29,
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
          </div>
          <KeyboardDockedAction active={focused}>
            <div data-keep-keyboard>
              <NextButton onClick={onNext} disabled={!value.trim()} />
            </div>
          </KeyboardDockedAction>
        </div>
      </div>
    </ScreenShell>
  )
}

export function Onboarding({
  onComplete,
  mode = 'full',
  seed,
  onCancel,
}: Props) {
  const adding = mode === 'addYoshi'
  const knownUserName = (seed?.userName ?? '').trim()
  const [step, setStep] = useState<Step>(adding ? 'relationship' : 'splash')
  const [userName, setUserName] = useState(knownUserName)
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
  /** Name the new Yoshi should address the user by */
  const addressedUserName = adding
    ? knownUserName || 'friend'
    : userName.trim() || 'friend'

  useEffect(() => {
    if (relIndex >= relationshipTypes.length) {
      setRelIndex(Math.max(0, relationshipTypes.length - 1))
    }
  }, [relIndex, relationshipTypes.length])

  const landOnHome = (name?: string) => {
    const resolvedName = adding
      ? knownUserName || userName.trim()
      : (name ?? userName.trim())
    onComplete({
      userName: resolvedName,
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

  const progress = flowProgress(step, mode)
  const goBack = () => {
    const prev = flowBackTarget(step, mode)
    if (prev) {
      setStep(prev)
      return
    }
    if (adding) onCancel?.()
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
        userName={addressedUserName}
        image={meetSelection.image}
        warmth={meetSelection.warmth}
        onNext={() => {
          if (adding) landOnHome()
          else setStep('hobbies')
        }}
        onBack={goBack}
      />
    )
  } else if (step === 'hobbies') {
    body = (
      <HobbiesChatStep
        yoshiName={chosenYoshiName}
        userName={addressedUserName}
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
