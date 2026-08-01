import { useState } from 'react'
import { FuiboFlower } from './fuibo/FuiboFlower'
import { Onboarding, type OnboardingResult } from './fuibo/Onboarding'
import { useCompactViewport } from './hooks/useCompactViewport'

export default function App() {
  const [result, setResult] = useState<OnboardingResult | null>(null)
  const compact = useCompactViewport()

  return (
    <div
      style={{
        minHeight: '100dvh',
        height: compact ? '100dvh' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? 0 : '48px 24px',
        overflow: compact ? 'hidden' : 'visible',
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
