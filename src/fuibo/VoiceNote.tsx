import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceClip = {
  url: string
  seconds: number
  peaks: number[]
}

type Props = {
  clip: VoiceClip | null
  onChange: (clip: VoiceClip | null) => void
  /** Empty / abandoned session — return the card to idle. */
  onCancel?: () => void
}

const BARS = 44
const SAMPLE_MS = 80
const MAX_SECONDS = 60
const IDLE_PEAKS = new Array(BARS).fill(0.12)

/** Average the raw amplitude samples down to a fixed bar count. */
function toPeaks(samples: number[]) {
  if (!samples.length) return new Array(BARS).fill(0.08)
  const out: number[] = []
  const per = samples.length / BARS
  for (let i = 0; i < BARS; i++) {
    const from = Math.floor(i * per)
    const to = Math.max(from + 1, Math.floor((i + 1) * per))
    let sum = 0
    for (let j = from; j < to && j < samples.length; j++) sum += samples[j]
    out.push(sum / (to - from))
  }
  const loudest = Math.max(...out, 0.001)
  // normalise so a quiet room still draws a readable wave
  return out.map((v) => Math.max(0.08, Math.min(1, v / loudest)))
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceNote({ clip, onChange, onCancel }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [live, setLive] = useState<number[]>([])
  const [denied, setDenied] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const samplesRef = useRef<number[]>([])
  const tickRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const teardown = useCallback(() => {
    window.clearInterval(tickRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    recorderRef.current = null
  }, [])

  useEffect(() => teardown, [teardown])

  const start = async () => {
    setDenied(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)

      samplesRef.current = []
      setLive([])
      setElapsed(0)

      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.onstop = () => {
        const seconds = samplesRef.current.length * (SAMPLE_MS / 1000)
        const url = URL.createObjectURL(new Blob(chunks))
        if (clip?.url) URL.revokeObjectURL(clip.url)
        onChange({ url, seconds, peaks: toPeaks(samplesRef.current) })
        teardown()
      }
      recorder.start()
      setRecording(true)

      tickRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        samplesRef.current.push(rms)
        const nextElapsed = samplesRef.current.length * (SAMPLE_MS / 1000)
        setElapsed(nextElapsed)
        setLive(samplesRef.current.slice(-BARS))
        if (nextElapsed >= MAX_SECONDS) {
          window.clearInterval(tickRef.current)
          setRecording(false)
          if (recorderRef.current?.state === 'recording') {
            recorderRef.current.stop()
          } else {
            teardown()
          }
        }
      }, SAMPLE_MS)
    } catch {
      setDenied(true)
      teardown()
    }
  }

  const stop = () => {
    setRecording(false)
    window.clearInterval(tickRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    else teardown()
  }

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) void el.play()
    else el.pause()
  }

  const seekTo = (fraction: number) => {
    const el = audioRef.current
    if (!el || !clip) return
    const target =
      fraction * (Number.isFinite(el.duration) ? el.duration : clip.seconds)
    el.currentTime = Math.max(0, target)
    setProgress(fraction)
  }

  if (denied) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#8B8794', lineHeight: 1.5 }}>
          The microphone is blocked. Allow it in your browser settings to record
          a voice note.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={start} style={pillStyle}>
            Try again
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              style={{
                ...pillStyle,
                background: 'transparent',
                color: '#8B8794',
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  // One surface for idle + recording: waveform + press to record / stop
  if (!clip || recording) {
    const bars = recording
      ? [...live, ...new Array(Math.max(0, BARS - live.length)).fill(0)]
      : IDLE_PEAKS
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <Wave
          peaks={bars}
          played={0}
          color={recording ? '#E2574C' : '#C8C4D2'}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={recording ? stop : start}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            style={{
              ...roundStyle,
              background: '#E2574C',
            }}
          >
            {recording ? (
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: '#fff',
                }}
              />
            ) : (
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                }}
              />
            )}
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#17151C' }}>
            {formatClock(elapsed)}
            <span style={{ color: '#B9B6C4', fontWeight: 500 }}>
              {' '}
              / {formatClock(MAX_SECONDS)}
            </span>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 13,
              color: recording ? '#B9302A' : '#8B8794',
            }}
          >
            {recording
              ? elapsed >= MAX_SECONDS - 0.05
                ? 'max length'
                : 'recording'
              : 'tap to record'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <audio
        ref={audioRef}
        src={clip.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          const total = Number.isFinite(el.duration) ? el.duration : clip.seconds
          setProgress(total ? el.currentTime / total : 0)
        }}
      />
      <Wave peaks={clip.peaks} played={progress} onSeek={seekTo} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          style={{ ...roundStyle, background: '#17151C' }}
        >
          {playing ? (
            <span style={{ display: 'flex', gap: 3 }}>
              <span style={pauseBar} />
              <span style={pauseBar} />
            </span>
          ) : (
            <span
              style={{
                width: 0,
                height: 0,
                marginLeft: 3,
                borderLeft: '11px solid #fff',
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
              }}
            />
          )}
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#17151C' }}>
          {formatClock(clip.seconds)}
        </div>
        <button
          type="button"
          onClick={() => {
            if (clip?.url) URL.revokeObjectURL(clip.url)
            setPlaying(false)
            setProgress(0)
            setElapsed(0)
            setLive([])
            onChange(null)
          }}
          style={{
            marginLeft: 'auto',
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            color: '#8B8794',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          Re-record
        </button>
      </div>
    </div>
  )
}

function Wave({
  peaks,
  played,
  color = '#17151C',
  onSeek,
}: {
  peaks: number[]
  played: number
  color?: string
  onSeek?: (fraction: number) => void
}) {
  return (
    <div
      onPointerDown={
        onSeek
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect()
              onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 40,
        cursor: onSeek ? 'pointer' : 'default',
        touchAction: 'none',
      }}
    >
      {peaks.map((p, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: Math.max(3, p * 36),
            borderRadius: 2,
            background: color,
            opacity: i / peaks.length <= played ? 1 : 0.22,
          }}
        />
      ))}
    </div>
  )
}

const pillStyle = {
  border: 'none',
  borderRadius: 999,
  background: 'rgba(23,21,28,0.06)',
  padding: '11px 16px',
  fontSize: 14,
  fontWeight: 600,
  color: '#17151C',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

const roundStyle = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
} as const

const pauseBar = {
  width: 4,
  height: 14,
  borderRadius: 1,
  background: '#fff',
} as const
