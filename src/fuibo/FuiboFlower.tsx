import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from 'react'
import { IOSDevice } from '../components/IOSDevice'
import { TopicDrawer } from './TopicDrawer'
import { SwitchYoshi } from './SwitchYoshi'
import { DEFAULT_YOSHI_ID, getYoshi } from './yoshis'

type Msg =
  | { type: 'them'; text: string }
  | { type: 'me'; text: string }
  | { type: 'divider' }

const OPENERS = [
  "Okay — I dug into that AWS outage story for you. Turns out a single config push took down half the internet's Tuesday. Want the short version or the nerdy version?",
  "Here's the roadmap thing you flagged. Three items shipped, two slipped to next sprint. Want me to flag which ones are blocking you?",
  "Circling back on this one — you never told me how it went. So? How'd it go?",
]

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

function ChatBubbleIcon() {
  return (
    <div
      style={{
        position: 'relative',
        width: 23,
        height: 18,
        borderRadius: 8,
        background: '#FFF8F3',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 4,
          bottom: -3,
          width: 7,
          height: 7,
          background: '#FFF8F3',
          borderRadius: 1,
          transform: 'rotate(45deg)',
        }}
      />
    </div>
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

function BackArrow() {
  return (
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
  )
}

type FuiboFlowerProps = {
  initialYoshiId?: string
  /** Custom display name for the Yoshi chosen during onboarding */
  nameOverride?: string
  /** Portrait from the relationship type chosen in onboarding */
  imageOverride?: string
  /** Temporary: homepage menu restarts onboarding for testing */
  onRestartOnboarding?: () => void
}

export function FuiboFlower({
  initialYoshiId = DEFAULT_YOSHI_ID,
  nameOverride,
  imageOverride,
  onRestartOnboarding,
}: FuiboFlowerProps = {}) {
  const [screen, setScreen] = useState<'home' | 'chat' | 'game' | 'switch'>('home')
  const [yoshiId, setYoshiId] = useState(initialYoshiId)
  const baseYoshi = getYoshi(yoshiId)
  const yoshi =
    yoshiId === initialYoshiId && (nameOverride || imageOverride)
      ? {
          ...baseYoshi,
          name: nameOverride ?? baseYoshi.name,
          image: imageOverride ?? baseYoshi.image,
        }
      : baseYoshi
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [kb, setKb] = useState(false)
  const [attach, setAttach] = useState(false)
  const [thread, setThread] = useState<Msg[]>(INITIAL_THREAD)
  const [draft, setDraft] = useState('')

  const threadRef = useRef<HTMLDivElement>(null)
  const titleBlockRef = useRef<HTMLDivElement>(null)
  const dragMoved = useRef(false)
  const sbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Default assumes two title lines; one-liners pull the image up once measured
  const [heroTop, setHeroTop] = useState(TITLE_TOP + 48 * 1.2 * 2 + TITLE_TO_HERO_GAP)

  const kbVisible = kb && !open
  const badge = !seen && !open
  const composerPb = kb ? 10 : 34
  const attachBottom = kb ? 72 : 96
  const threadPb = kb ? 100 : 124

  useLayoutEffect(() => {
    const el = titleBlockRef.current
    if (!el || screen !== 'home') return
    const measure = () => {
      // Use TITLE_TOP (not offsetTop) so shifting the title also shifts the hero
      setHeroTop(TITLE_TOP + el.offsetHeight + TITLE_TO_HERO_GAP)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [yoshi.name, screen])

  useEffect(() => {
    const el = threadRef.current
    if (!el || screen !== 'chat') return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [thread.length, kb, screen])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'fuibo-close-game') setScreen('home')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const flashScrollbar = (el: HTMLElement) => {
    el.classList.add('is-scrolling')
    if (sbTimer.current) clearTimeout(sbTimer.current)
    sbTimer.current = setTimeout(() => el.classList.remove('is-scrolling'), 850)
  }

  const startTopic = (i: number) => {
    if (dragMoved.current) {
      dragMoved.current = false
      return
    }
    setScreen('chat')
    setOpen(false)
    setSeen(true)
    setKb(false)
    setAttach(false)
    setThread((t) => [...t, { type: 'divider' }, { type: 'them', text: OPENERS[i] }])
  }

  const toggle = () => {
    setOpen((o) => !o)
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

  const onThreadScroll = (e: UIEvent<HTMLDivElement>) => {
    flashScrollbar(e.currentTarget)
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
          top: 64,
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
          top: TITLE_TOP,
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
            // Narrow enough that "Fuibo Flower" wraps; "Lady God" / "Dad" stay one line
            paddingRight: 90,
          }}
        >
          {yoshi.name}
        </div>
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
      </div>

      <div
        style={{
          position: 'absolute',
          top: heroTop,
          left: 18,
          right: 18,
          bottom: 56,
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
          left: 30,
          bottom: 36,
          maxWidth: 214,
          zIndex: 8,
          background: '#FFFFFF',
          borderRadius: '14px 14px 14px 4px',
          padding: '12px 15px',
          fontSize: 14,
          lineHeight: 1.4,
          color: '#2A2620',
          boxShadow: '0 10px 26px rgba(26,24,20,.28)',
        }}
      >
        Wanna see the baby version of your rabbit?
      </div>

      <div
        onClick={() => {
          setScreen('chat')
          setOpen(false)
        }}
        style={{
          position: 'absolute',
          right: 30,
          bottom: 34,
          zIndex: 8,
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: '#C05A3C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 28px rgba(192,90,60,.45)',
          cursor: 'pointer',
        }}
      >
        <ChatBubbleIcon />
      </div>

      <div
        onClick={toggle}
        style={{
          position: 'absolute',
          top: 64,
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
          objectPosition: '50% 20%',
          borderRadius: '0 0 28px 28px',
          display: 'block',
          zIndex: 0,
        }}
        alt={yoshi.name}
      />

      <div
        ref={threadRef}
        className="fuibo-scroll"
        onScroll={onThreadScroll}
        onClick={() => {
          if (kb) setKb(false)
        }}
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
          paddingBottom: threadPb,
          WebkitMaskImage:
            'linear-gradient(to bottom,transparent 122px,#000 312px)',
          maskImage: 'linear-gradient(to bottom,transparent 122px,#000 312px)',
        }}
      >
        {thread.map((m, i) => {
          if (m.type === 'them') {
            return (
              <div
                key={i}
                style={{
                  maxWidth: '80%',
                  alignSelf: 'flex-start',
                  background: '#FFFFFF',
                  borderRadius: 18,
                  padding: '14px 16px',
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: '#2A2620',
                  boxShadow: '0 4px 16px rgba(26,24,20,.10)',
                  whiteSpace: 'pre-line',
                  animation: 'fuiboMsgIn .28s ease',
                }}
              >
                {m.text}
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

      <div
        onClick={() => {
          setScreen('home')
          setOpen(false)
          setKb(false)
          setAttach(false)
        }}
        style={{
          position: 'absolute',
          top: 64,
          left: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 4px 14px rgba(26,24,20,.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 12,
        }}
      >
        <BackArrow />
      </div>

      <div
        onClick={toggle}
        style={{
          position: 'absolute',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(26,24,20,.18)',
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
              bottom: attachBottom,
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
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: `10px 16px ${composerPb}px`,
          background: '#EDECF2',
        }}
      >
        <div
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
        title="Mowing with Yoshi"
        src="/mowing/mowing_with_yoshi.html?embed=1"
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
      selectedId={yoshiId}
      onBack={() => setScreen('home')}
      onSelect={(id) => {
        setYoshiId(id)
        setScreen('home')
      }}
    />
  )

  return (
    <IOSDevice keyboard={kbVisible && screen === 'chat'}>
      {screen === 'home'
        ? home
        : screen === 'chat'
          ? chat
          : screen === 'game'
            ? game
            : switchScreen}
    </IOSDevice>
  )
}
