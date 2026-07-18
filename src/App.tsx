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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: 402,
        }}
      >
        <div
          style={{
            font: "600 11px 'Geist',sans-serif",
            letterSpacing: '.14em',
            color: '#C05A3C',
          }}
        >
          ◆ INTERACTIVE PROTOTYPE
        </div>
        <div
          style={{
            font: "400 12px 'Geist',sans-serif",
            color: 'rgba(26,24,20,.5)',
          }}
        >
          {result
            ? 'home · chat · switch · topics'
            : 'onboarding · auth · name · interests'}
        </div>
      </div>
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
