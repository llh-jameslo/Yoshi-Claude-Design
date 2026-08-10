import { useEffect, useState } from 'react'
import { FuiboFlower } from './fuibo/FuiboFlower'
import { Onboarding, type OnboardingResult } from './fuibo/Onboarding'
import {
  emptySlotCount,
  ownedFromResult,
  type UserProfile,
} from './fuibo/ownedYoshis'
import { firstEncounterMemory, type Memory } from './fuibo/memories'
import { useCompactViewport } from './hooks/useCompactViewport'

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
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
      const userName = profile.userName || next.userName
      setProfile({
        userName,
        yoshis: [...profile.yoshis, owned],
        activeId: owned.id,
      })
      // Every Yoshi plants a flower for the day you met
      setMemories((prev) => [
        ...prev,
        firstEncounterMemory(owned, userName, prev),
      ])
      setAddingYoshi(false)
      return
    }

    const owned = ownedFromResult(next)
    setProfile({
      userName: next.userName,
      yoshis: [owned],
      activeId: owned.id,
    })
    setMemories([firstEncounterMemory(owned, next.userName)])
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
          memories={memories}
          onSaveMemory={(memory) =>
            setMemories((prev) =>
              prev.some((m) => m.id === memory.id)
                ? prev.map((m) => (m.id === memory.id ? memory : m))
                : [...prev, memory],
            )
          }
          onDeleteMemory={(id) =>
            setMemories((prev) => prev.filter((m) => m.id !== id))
          }
          onRestartOnboarding={() => {
            setProfile(null)
            setMemories([])
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
