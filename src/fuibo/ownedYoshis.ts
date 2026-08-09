import { getYoshi } from './yoshis'

/** A Yoshi the user has created (distinct from catalog template ids). */
export type OwnedYoshi = {
  id: string
  templateId: string
  name: string
  image: string
  relationshipId: string
}

export type UserProfile = {
  userName: string
  yoshis: OwnedYoshi[]
  activeId: string
}

type YoshiCreatePayload = {
  yoshiId: string
  yoshiName: string
  yoshiImage: string
  relationshipId: string
}

/** Max companions + empty add slots on Switch (1 filled + 2 empty at start). */
export const MAX_OWNED_YOSHIS = 3

export function emptySlotCount(ownedCount: number) {
  return Math.max(0, MAX_OWNED_YOSHIS - ownedCount)
}

export function newOwnedId() {
  return `yoshi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ownedFromResult(
  result: YoshiCreatePayload,
  id = newOwnedId(),
): OwnedYoshi {
  return {
    id,
    templateId: result.yoshiId,
    name: result.yoshiName,
    image: result.yoshiImage,
    relationshipId: result.relationshipId,
  }
}

export function toSwitchYoshi(owned: OwnedYoshi) {
  const template = getYoshi(owned.templateId)
  return {
    id: owned.id,
    name: owned.name,
    image: owned.image,
    accent: template.accent,
  }
}
