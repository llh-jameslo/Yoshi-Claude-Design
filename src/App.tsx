import { useState } from 'react'
import { FuiboFlower } from './fuibo/FuiboFlower'
import { Onboarding, type OnboardingResult } from './fuibo/Onboarding'

export default function App() {
  const [result, setResult] = useState<OnboardingResult | null>(null)

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
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
