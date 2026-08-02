import { useEffect, useState } from 'react'
import { FuiboFlower } from './fuibo/FuiboFlower'
import { Onboarding, type OnboardingResult } from './fuibo/Onboarding'
import { useCompactViewport } from './hooks/useCompactViewport'

export default function App() {
  const [result, setResult] = useState<OnboardingResult | null>(null)
  const compact = useCompactViewport()

  useEffect(() => {
    document.documentElement.dataset.deviceChrome = compact ? 'off' : 'on'
    return () => {
      delete document.documentElement.dataset.deviceChrome
    }
  }, [compact])

  return (
    <div
      style={{
        minHeight: compact ? '100%' : '100dvh',
        height: compact ? '100%' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? 0 : '48px 24px',
        overflow: compact ? 'hidden' : 'visible',
        background: compact ? '#F2F0F8' : undefined,
      }}
    >
      {result ? (
        <FuiboFlower
          initialYoshiId={result.yoshiId}
          nameOverride={result.yoshiName}
          imageOverride={result.yoshiImage}
          onRestartOnboarding={() => setResult(null)}
        />
      ) : (
        <Onboarding onComplete={setResult} />
      )}
    </div>
  )
}
