import { useEffect, useState } from 'react'
import { FuiboFlower } from './fuibo/FuiboFlower'
import { Onboarding, type OnboardingResult } from './fuibo/Onboarding'
import {
  emptySlotCount,
  ownedFromResult,
  type UserProfile,
} from './fuibo/ownedYoshis'
import { useCompactViewport } from './hooks/useCompactViewport'

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [addingYoshi, setAddingYoshi] = useState(false)
  const compact = useCompactViewport()

  useEffect(() => {
    document.documentElement.dataset.deviceChrome = compact ? 'off' : 'on'
    return () => {
      delete document.documentElement.dataset.deviceChrome
    }
  }, [compact])

  const finishOnboarding = (next: OnboardingResult) => {
    if (addingYoshi && profile) {
      const owned = ownedFromResult(next)
      setProfile({
        userName: profile.userName || next.userName,
        yoshis: [...profile.yoshis, owned],
        activeId: owned.id,
      })
      setAddingYoshi(false)
      return
    }

    const owned = ownedFromResult(next)
    setProfile({
      userName: next.userName,
      yoshis: [owned],
      activeId: owned.id,
    })
    setAddingYoshi(false)
  }

  const active = profile?.yoshis.find((y) => y.id === profile.activeId)

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
      {profile && active && !addingYoshi ? (
        <FuiboFlower
          userName={profile.userName}
          yoshis={profile.yoshis}
          activeYoshiId={profile.activeId}
          emptySlots={emptySlotCount(profile.yoshis.length)}
          onSelectYoshi={(id) =>
            setProfile((prev) => (prev ? { ...prev, activeId: id } : prev))
          }
          onRestartOnboarding={() => {
            setProfile(null)
            setAddingYoshi(false)
          }}
          onAddYoshi={
            emptySlotCount(profile.yoshis.length) > 0
              ? () => setAddingYoshi(true)
              : undefined
          }
        />
      ) : (
        <Onboarding
          mode={addingYoshi ? 'addYoshi' : 'full'}
          seed={
            addingYoshi && profile
              ? {
                  userName: profile.userName,
                  yoshiId: active?.templateId ?? 'fuibo-flower',
                  yoshiName: active?.name ?? '',
                  yoshiImage: active?.image ?? '',
                  relationshipId: active?.relationshipId ?? 'friend',
                }
              : undefined
          }
          onCancel={addingYoshi ? () => setAddingYoshi(false) : undefined}
          onComplete={finishOnboarding}
        />
      )}
    </div>
  )
}
