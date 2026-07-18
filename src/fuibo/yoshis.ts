export type Yoshi = {
  id: string
  name: string
  image: string
  accent: string
}

export const YOSHIS: Yoshi[] = [
  {
    id: 'lady-god',
    name: 'Lady God',
    image: '/assets/yoshi-lady-god.png',
    accent: '#F6E4A8',
  },
  {
    id: 'fuibo-flower',
    name: 'Fuibo Flower',
    image: '/assets/yoshi-flipped.png',
    accent: '#A898CF',
  },
  {
    id: 'dad',
    name: 'Dad',
    image: '/assets/yoshi-dad.png',
    accent: '#CF9899',
  },
]

export const DEFAULT_YOSHI_ID = 'fuibo-flower'

export function getYoshi(id: string): Yoshi {
  return YOSHIS.find((y) => y.id === id) ?? YOSHIS[1]
}

/** Selected Yoshi first; the rest keep base order (Lady God → Fuibo Flower → Dad). */
export function orderedYoshis(selectedId: string): Yoshi[] {
  const selected = getYoshi(selectedId)
  const rest = YOSHIS.filter((y) => y.id !== selected.id)
  return [selected, ...rest]
}
