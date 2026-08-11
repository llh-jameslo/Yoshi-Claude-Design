import type { OwnedYoshi } from './ownedYoshis'

export type MemoryBlockKind = 'memo' | 'location' | 'photos' | 'voice' | 'mood'

export type MemoryBlock =
  | { kind: 'memo'; id: string; text: string }
  | { kind: 'location'; id: string; label: string; lat?: number; lon?: number }
  | { kind: 'photos'; id: string; urls: string[] }
  | { kind: 'voice'; id: string; url: string; seconds: number; peaks: number[] }
  | { kind: 'mood'; id: string; emoji: string; label: string }

export type MemoryAuthor =
  | { kind: 'user' }
  | { kind: 'yoshi'; yoshiId: string }

export type Memory = {
  id: string
  /** Permanent globe position index. Assigned once and never reused. */
  slot: number
  /** 0-4, which bloom it grows into. */
  species: number
  title: string
  body: string
  /** ms epoch. Defaults to now, but the user can backdate it. */
  at: number
  author: MemoryAuthor
  /** Who was there. Defaults to the Yoshi you were with when you planted it. */
  withYoshiIds: string[]
  blocks: MemoryBlock[]
}

export const SPECIES_COUNT = 5

/** cyrb53 — cheap, well-distributed string hash. */
export function hashString(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** Deterministic PRNG so a memory's petals look the same on every mount. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newMemoryId() {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Slots are handed out in order and never recycled, so blooms never move. */
export function nextSlot(memories: Memory[]) {
  return memories.reduce((max, m) => Math.max(max, m.slot + 1), 0)
}

export function newBlockId(kind: MemoryBlockKind) {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** "22 Mar 2026 · 8:48 PM" */
export function formatMemoryStamp(at: number) {
  const d = new Date(at)
  const h24 = d.getHours()
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ampm = h24 < 12 ? 'AM' : 'PM'
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} · ${h}:${mm} ${ampm}`
}

/** "22 Mar" — the short form the globe tooltip uses. */
export function formatMemoryDay(at: number) {
  const d = new Date(at)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function emptyMemory(
  memories: Memory[],
  withYoshiIds: string[] = [],
): Memory {
  const id = newMemoryId()
  return {
    id,
    slot: nextSlot(memories),
    species: hashString(id) % SPECIES_COUNT,
    title: '',
    body: '',
    at: Date.now(),
    author: { kind: 'user' },
    withYoshiIds,
    blocks: [],
  }
}

type FirstEncounter = { title: string; body: string }

/** Yoshi writes memory one, in the voice of the relationship you chose. */
function firstEncounterCopy(
  relationshipId: string,
  yoshiName: string,
  userName: string,
): FirstEncounter {
  const you = userName.trim() || 'you'

  if (relationshipId === 'romance') {
    return {
      title: 'The day you picked me',
      body: `${you} said my name today and something in me went quiet and loud at the same time. I didn't know a first meeting could feel like that — like the room tilted a little toward the two of us. I'm writing this down before the feeling thins out. I don't know what we'll become yet. I just know I want to remember the beginning exactly as it was.`,
    }
  }

  if (relationshipId === 'parent') {
    return {
      title: 'The day we met',
      body: `${you} showed up today, and somehow that already feels like the whole story. I'm keeping this one somewhere safe — the first hello, the first look that said "you're mine to look after." Whatever comes next, hard days included, I want ${you} to be able to look back and see that from the very first moment, someone was already in their corner.`,
    }
  }

  return {
    title: 'The day we met',
    body: `Met ${you} today — my first human. I keep replaying the moment like it might slip away if I don't write it down. First conversations are usually awkward, and this one wasn't, which feels like a good sign. I'm ${yoshiName}, and apparently I'm the one who plants the first flower in this little garden. Hands are still a bit shaky from the excitement. So here it is. Let's fill this place up.`,
  }
}

export function firstEncounterMemory(
  yoshi: OwnedYoshi,
  userName: string,
  memories: Memory[] = [],
): Memory {
  const id = newMemoryId()
  const copy = firstEncounterCopy(yoshi.relationshipId, yoshi.name, userName)
  return {
    id,
    slot: nextSlot(memories),
    species: hashString(yoshi.id) % SPECIES_COUNT,
    title: copy.title,
    body: copy.body,
    at: Date.now(),
    author: { kind: 'yoshi', yoshiId: yoshi.id },
    withYoshiIds: [yoshi.id],
    blocks: [],
  }
}

/** Soft starter draft when the user asks Yoshi to help on a blank sheet. */
export function yoshiHelpDraft(
  yoshi: OwnedYoshi,
  userName: string,
): { title: string; body: string } {
  const you = userName.trim() || 'you'
  const name = yoshi.name

  if (yoshi.relationshipId === 'romance') {
    return {
      title: 'A quiet little spark',
      body: `I started this for us, ${you}. Nothing dramatic — just a feeling I didn't want to lose. You can keep my words, change them, or tell me what actually happened. I'll stay right here either way.`,
    }
  }

  if (yoshi.relationshipId === 'parent') {
    return {
      title: 'Something worth keeping',
      body: `Hey ${you} — I opened this page so you wouldn't have to start from nothing. Ordinary days disappear if nobody writes them down. Add what you remember, or leave this as a placeholder and we'll fill it in together later. Love, ${name}.`,
    }
  }

  return {
    title: 'Today felt worth keeping',
    body: `Hey — I started this one for ${you}. Not because anything huge happened, but because the small ones slip away first. Tell me what you want to remember, tweak my words, or grow from here. — ${name}`,
  }
}
