import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useCallback,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

type Noble = {
  x: number
  y: number
  vx: number
  vy: number
  f: number
  t: number
  turn: number
  pop: number
}

export type WanderingNoblesHandle = {
  spawnRandom: () => void
  spawnAt: (e: Pick<ReactMouseEvent, 'clientX' | 'clientY'>) => void
  clear: () => void
}

type WanderingNoblesProps = {
  initialCount?: number
  size?: number
  minSpeed?: number
  maxSpeed?: number
  maxCount?: number
  captureClicks?: boolean
  style?: CSSProperties
}

const TRASH_SIZE = 48
const TRASH_PAD = 12
const DRAG_THRESHOLD = 6

// 4-frame walk cycle of the blindfolded noble, embedded so there are no asset files to manage.
const FRAMES = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAFmUlEQVR4nO2cT2gdVRSHT8XsIsGqURIQJdEmBTUUkVKyUKQghLqooJsWCa5sN+Kqm65KIStxla5UpO2igi4MXQWxiyAipUQLxv6jIqRokqYEs8sirg7OnLz75s689+aeeb/ft5s7b+bdeTnnu+fed/P2CQjHXn9xt8p1C9fv7+t2XzzxWOoOkLT0XXRXzfSy9IsZaABwGhvFdWV6LNYItn9ejUEDgOMyKtuhmTX69BO59tWNf3PHXs97MwENAM7jqTsQSyjzLV7Pa7s+hxcT0ADgMADAYQCA05gaQNFqOjTWej1vZwleoAHAcVGJxuBt5a8qXqp/hQYAx1U0toKZ31toAHAYAOAwAMBhAIDDAACHAQAOAwAcl3PTLBMTU41eB9jcXG/Z/tv3J3PHzx2eS/K3oAHAcW+ApS/f6cgA4wenRETk7u/LXehNPMfP3Mwd24x/9d2LIiKytraa9G9AA4Dj3gDDw6ONrgE08zXjQ6QyAQ0AjnsDNK0GsGN/LDQASYJ7AzS9BoiFBiBJcL8r+Lu5Vzq6PnUNEDsLSAUNAA5rgJoImYArgSQpNEDNePkWUKEBwHFvAGVwcGhXROTewme59oeL7VfenjraehZxb2Wl7XVjk5Mdvc/YsU9FRGR7e6vtZ/z3z2d2RbgfgCTCnQGWl39pOeZPTx8Vkf8NUJSRlmsPlir1582R6VKvVxOoAZaWFnPnp6becPWZ0wDguFkJ1Mw/8PKBXPut27cq3c9m/Hsffpw7jq0Bvv36Qq69rBHs8+hzejEBDQBOcgOEMr8Im+GamdpelKma4dYEtvq397H332Maaf/dhT6nFxPQAOAki77YzNcaQF/3zPDzIrJ3NhDK/NA6QFnsrMO+n63+19f+irqvPl8qE9AA4CSvATpFM69o7O3W+yi9fr+6oAHAcW8AHfurrgekwtYuXqEBwHFvAJtJWl3b2UBqQtV/rAlSrQvQAODUboDQt32WpoyhRdgaJvQ8qVYIaQBwal99siuAocwItX916u2W9x0Z3t/djkbyYG2zZfvs/A+5Y/s8Rc9NA5BaSD4LiB0j+wVv6xk0ADjJDaA0dcWvLLG1Tl3QAOC4MYBSZAKtru1sQKvxumYDsdW/d2gAcGo3gM5vi3YEeZ8dnF/caNk+a45j+59qZxANAE7yPYFK2b2BSt0rg6cv34563dWr34iI38xXaABwkhug6vy/bhPEZr7l7p1f256nAUhSkv9/WtX/DLLG0OtDJlBijWDn+aGqv4iQAVJnvkIDgJPcAEpZE4S+X1d++vxUN7vXNQN4yXyFBgDHRRRmid0zWNYUVY1w5JN5ERGZmXm/0vWKrgt4yXyFBgDHVTRmGR19IWeC2JW1EJ1+pzD+0muVrlNWV/90+VnTAOC4jEqRvQZQypqg08y311c1AQ1AXOJuR1AR+nuB9vf3Qmj1XtUcoeN+gQYAx924FBr7la2tRyIiMjT0ZKX7qwmK6HTeH8JbLUADgNO4GqBTbGZfOTchIiIfnP0jRXeSQwOAA2cAC2rmKzQAOG4q0l5X/97wMhugAcBxWwPcuHQ2d6y/wuUd22/l0IlzNfckDhoAHHcGCGVQr+jWOkBRv/W8NxPQAOC4qERFRP758Yu2swCtAbzNAqoa69m3PnLx2dMA4DAAwGEAgMMAAIcBAI6LSjRLaDbQq1lAXesAipfqX6EBwHEVjVnUBF7n/yFCJvCW+QoNAI7LqMwyODi0K9IcA1h0H8P29pbLz5oGAIcBAA4DABx3+wFC6FhKugsNAI7LyjSGol3EdeNll29ZaABwGhm1WVKboKmZr9AA4DAAwGEAgMMAAIcBAE6jK9gsdc8Gml79KzQAOAwAcBgA4PTFOJYlthbY2dlp2T4wMBD1PqwBSF/QmP0AVQlleuzrY43QVGgAcP4DP2Y3dteeo1UAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAFY0lEQVR4nO2dT2gdVRSHT8XsKsF/URoQpdWmghpERCQLRQpCqQsF3ShSXFk34qqbrorQlbhqV1VEXSjowtJVEF0EERGJCtbWFkVI0bRGgt1l8Vwdkjmd++bOzMucc/P7fbu5897MnZdzvjn3zn0vu2SHcfix+0ZDnOfs97/vGuI8281N3h0gvhQbxUNlei7WCLZ/UY1BA4ATMirHoZk1e8ctlfaVa/9VtqPuj2YCGgCcm707kEsq8y1R92u7XkcUE9AA4DAAwGEAgFNMDaBoNZ2610bdb0cJUaABwAlRieYQbeavK1Gqf4UGACdUNNbBzN9eaABwGADgMADAYQCAwwAAhwEADgMAnJBj063Mzc0XPQ+wtna1tv2nL16pbN/9xEmXvwUNAE54Ayy992wvA+x7cF5ERC79sjyB3uTz/LGfK9s24x9+7kMREVldXXH9G9AA4IQ3wMzMbNE1gGa+ZnwKLxPQAOCEN0BpNYC99+dCAxAXwhug9BogFxqAuBB+VfDnJx/q9X7vGiB3FOAFDQAOa4CBSJmAM4HEFRpgYKI8BVRoAHDCG0DZvXt6JCJy+ew7lfZ/FsfPvN1+sH4Ucfn8+bHv23vgQK/z7D38loiIXL++PvYz/uvbYyMRrgcgToQzwPLyd7X3/IWFgyKyaYCmjLR8fWWpU3+e2rPQ6vVqAjXA0tJiZf/8/OOhPnMaAJwwM4Ga+fsf2F9pv3DxQqfj2Yx/4dXXK9u5NcBnH5yutLc1gr0evc4oJqABwHE3QCrzm7AZrpmp7U2ZqhluTWCrf3sce/wbTCPjn13odUYxAQ0Ajlv05Wa+1gD6ujtn7hGRG0cDqcxPzQO0xY467Pls9X919c+s4+r1eZmABgDHvQboi2Ze0713UudRtvt8Q0EDgBPeAHrv7zof4IWtXaJCA4AT3gA2k7S6tqMBb1LVf64JvOYFaABwBjdA6mmfpZR7aBO2hkldj9cMIQ0AzuCzT3YGMJUZqfb3jz5Te9w9M7dNtqOZXFldq20/curLyra9nqbrpgHIILiPAnLvkTuFaPMZNAA47gZQSp3xa0turTMUNAA4YQygNJlAq2s7GtBqfKjRQG71Hx0aAJzBDaDj26YVQdFHB28vXqttP2K2c/vvtTKIBgDHfU2g0nZtoDL0zOAbH1/Met25c5+KSNzMV2gAcNwN0HX8P7QJcjPfcum3H8fupwGIK+7fT+v6zSBrDH1/ygRKrhHsOD9V9TeRMoB35is0ADjuBlDamiD1fF355t2jk+zexAwQJfMVGgCcEFG4ldw1g21N0dUIT755SkREDh16sdP7dT5AiZL5Cg0ATqhorGN29t6RSP7MWoq+zxT23f9Ip/etrPwR+jOmAcAJtx4ghd6D25qgb+bv9BVKNAA4xRhA0d8LtL+/l6KvOXY6NAA4oStUkc1RgLK+/q+IiExP39rpeHZcnqLruN/CUQAJTXE1QF9sZn9yYk5ERF46/qtHd9yhAcCBM4AFNfMVGgCcYgzQt/on9dAA4BRjgGj88NHx2vZHXz4xcE/6QQOAA2+AtvMAqcy3+0sxAQ0ATuh5ahGRv786MxLZ/CVOr1FAU+anuOvp10J/xjQAOAwAcBgA4DAAwGEAgBO6Qt2K/vfwSY8CJj0PoOT+93BvaABwQkenyPZlfl9ynwXoU8yoJqABwAkZlVuJaoBcaAASGgYAOAwAcIpZD6D3UjJZaABwQlamOdjvDLbFfmdv0scrBRoAHAYAOAwAcBgA4DAAwGEAgMMAAIcBAA4DABwGADgMAHCKeRqYy8bGRm371NSUy3GiQwOAU7wBUpna9nVdj1O6EWgAcBgA4DAAwPkfBIQoGMpABn0AAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAFgUlEQVR4nO2cP4gdVRSHT8TtIov/HpIHEkk0G0FdRCTFFoIEhBALBW0USWnsrNKkCkIqsYqdImqRQCwMqRbBYhERkVXBmJigCBtkE1cW023xrA6+OXl35s68mXvP3d/v62bmvZk7u+d8c+6ZebNHQDj+3GOTLt+79P3ve/oeiyfuyT0AkpddF91dM70tu8UMNAA4xUZxqkyPxRrBjs+rMWgAcFxGZR2aWeOH7qus37j9b2XZ63ZvJqABwLk39wBiCWW+xet2Xa/n4cUENAA4DABwGADgFFMDKFpNh661XrfbWYIXaABwXFSiMXjr/HXFS/Wv0ADguIrGWTDzh4UGAIcBAA4DABwGADgMAHAYAOAwAMBxOTedZmlpueg+wNbWrZnrf/ryzcryI0fOZvlf0ADguDfA2kcvzWWAg08ui4jI9V/WexhNPK+c+rmybDP+6Zc/FRGRzc2NrP8DGgAc9wYYjcZF1wCa+ZrxIXKZgAYAx70BSqsB7LU/FhqAZMG9AUqvAWKhAUgW3D8V/MXZp+b6fu4aIHYWkAsaABzWAIkImYCdQJIVGiAxXu4CKjQAOO4NoOzduzgREblx6f3K+r9X6ztvDx6dPYu4ceVK7fcOHD4813EOHH9XRETu3Nmu/Rv/9e2piQifByCZcGeA9fXvZl7zV1aOisj/BmjKSMvXN9c6jeeFfSutPq8mUAOsra1Wti8vP+/qb04DgOOmE6iZf+iJQ5X1V69d7bQ/m/GvvvV2ZTm2Brj4yYeV9W2NYM9Hz9OLCWgAcLIbIJT5TdgM18zU9U2ZqhluTWCrf7sfu/+7TCP19y70PL2YgAYAJ1v0xWa+1gD6uYdHj4rI3bOBUOaH+gBtsbMOezxb/d/a/DNqv3p+uUxAA4CTvQaYF828pmtvX8dRhj5eKmgAcNwbQK/9XfsBubC1i1doAHDcG8BmklbXdjaQm1D1H2uCXH0BGgCc5AYI3e2zlHINbcLWMKHzydUhpAHASd59sh3AUGaE1n988sWZ+903eqDfgUZyc3Nr5voT576qLNvzaTpvGoAkIfssIPYauVvw1s+gAcDJbgCl1I5fW2JrnVTQAOC4MYDSZAKtru1sQKvxVLOB2OrfOzQAOMkNoPPbpieCvM4O3vn8Wu32E2Y5dvy5ngyiAcDJ/kyg0vbZQCVVZ7Ap8y2XL18QEb+Zr9AA4GQ3QNf5fyoTtM18y/XffqzdTgOQrGT/fVrXXwZZY+j3QyZQYo2g8/z3Vm+3GpclZIDcma/QAOBkN4DS1gSh++vKNx+c7GVcfRvAS+YrNAA4LqJwmthnBtuaoq0R5s187QNYvGS+QgOA4yoa6+g6W1Da3lM4+PgznY6jbGz8UcTflgYAx93zACFi7yJaUt9N3N7+J8lx+oIGAKcYAyj6vkD7/r0Qx469JiLxd+fQoAHAKaJSnUbfGby4eH+n74fm54oaoytaAzS9I9gLNAA4RUTpNPMawHL+zJKIiLx++tde9kcDkKIoIkqn6dsAQ1GKCWgAcIrpA5SS+aVBA4BTjAFS88Nnp2euf/aNM4lHMiw0ADiuK9RphqoBbB8glPmWJhNwFkCKwHV0TjP0LCA28y0hE9AApAgYAOAwAMBhAIDDAAAHvhOofQCt5vvqA5QCDQCO6zmqSL67gH3dC/DeD6ABwHEZldOU/hwADUBcwwAAhwEATjF9gNJ+dVsKNAA4LivTOsbj/VHvEGrCvsFjqP16hwYAp5hoTZWhaCagAcBhAAzEeLx/0pdNhoQBAA4DABwGADjFdALnJbYq18+VcP3uAxoAHPcGKD0Tdfxe+wI0ADjuDaDs7OzMXL+wsDDI8WJrgdTj6hsaABy3BhiNxhORcIYpdvvQmdc0nrafyw0NAM5/pb1TrooQ9VQAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAFUklEQVR4nO2dP4gdVRSHT8TtIotRF8mCGBLNRoguEsRiC0ECgRALA7FRJKWxs0qTKgipxEq7BIkWCloYUi1CiiWEILJRyD8TFGGDbOLKYrot1uqQNyfvvrkzb96cc/f3+7q5897MnbfnfPfcO/P2bZMtxpEDuzb7OM+Fn//Y1sd5Js0T3h0gvhQbxX1lei7WCLZ/UY1BA4ATMipHoZk1++xTlfaVB/9VtqPuj2YCGgCcJ707kEsq8y1R92u7XkcUE9AA4DAAwGEAgFNMDaBoNZ0aa6Put7OEKNAA4ISoRHOItvLXlijVv0IDgBMqGofBzJ8sNAA4DABwGADgMADAYQCAwwAAhwEATsi56SBzc/NFrwOsrd0f2v7rjx9Utp9/84zL34IGACe8AZbOHhrLAHtemRcRkTvXlzvoTT7vnvytsm0z/tV3zouIyOrqiuvfgAYAJ7wBZmZmi64BNPM141N4mYAGACe8AUqrAezYnwsNQFwIb4DSa4BcaADiQvingn84s3+s93vXALmzAC9oAHBYA/REygRcCSSu0AA9E+UuoEIDgBPeAMr27dObIiJ3L3xWaf9ncfTK2zMHh88i7t64MfJ9u/ftG+s8u498IiIiDx+uj/yM/75yclOEzwMQJ8IZYHn56tAxf2HhoIg8MkBdRlou3Vtq1Z+3di40er2aQA2wtLRY2T8//0aoz5wGACfMSqBm/t6X91bab92+1ep4NuOPfvhRZTu3Bvj+qy8r7U2NYK9HrzOKCWgAcNwNkMr8OmyGa2Zqe12maoZbE9jq3x7HHv8x08joexd6nVFMQAOA4xZ9uZmvNYC+7rmZF0Tk8dlAKvNT6wBNsbMOez5b/d9f/SvruHp9XiagAcBxrwHGRTOvbuzt6jzKpM/XFzQAOOENoGN/2/UAL2ztEhUaAJzwBrCZpNW1nQ14k6r+c03gtS5AA4DTuwFSd/sspYyhddgaJnU9XiuENAA4va8+2RXAVGak2s+deHvocXfO7Oi2o5ncW10b2n78i58q2/Z66q6bBiC94D4LyB0jtwrR1jNoAHDcDaCUuuLXlNxapy9oAHDCGECpM4FW13Y2oNV4X7OB3Oo/OjQAOL0bQOe3dU8ERZ0dfPzN7ZH7j5vt3P57PRlEA4Dj/kyg0vTZQKWvlcG6zLdcvPidiMTNfIUGAMfdAG3n/32ZoGnmW+78fm3kfhqAuOL+/bS23wyyxtD3p0yg5BpB5/mfLj5o1C9LygDema/QAOC4G0BpaoLU/XXl8ucnOulX1waIkvkKDQBOiCgcJPeZwaamaGuEtgbQdQBLlMxXaABwQkXjKNrOFpS29xT2vPRaq/OtrPxZxGdLA4AT7nmAFIcPHxOR/DV2JdrdxGjQAOAUYwBF/1+g/f97KcY1x1aHBgCniEpVRGR29sVNEZH19X9FRGR6+ulWx0nNzy1qjrZwFkCKoLgaYFxsZn97ek5ERN47ddOjO+7QAOAUMU6JdFcD9IX2s+73AryhAcAppgYoJfNLgwYApxgDROGXr08NbX/9/dM996QbaABwQleog+ivhnVdA+SuA6Qy36Im4CyAFEHo6BxkUgaoIzfzLbm/G+gNDQAOAwAcBgA4DABwGADghK5QB+E6wGSgAcAJHZ0ifvP/FE3vBUQ3AQ0ATsioHCSaAZpCA5DQMADAYQCAU8wTQTqWkm6hAcAJWZnmoN8TaIv97l7XxysFGgAcBgA4DABwGADgMADAYQCAwwAAhwEADgMAHAYAOAwAcIq5G1jHxsbG0PapqamQx40CDQBOsQZIZWbd6+oyt+1xS4UGAIcBAA4DAJz/AaIRNalaa8JKAAAAAElFTkSuQmCC"
];

function TrashIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z"
        stroke={active ? '#FFFFFF' : '#17151C'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke={active ? '#FFFFFF' : '#17151C'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * WanderingNobles — pixel nobles that wander over a relative parent.
 * Tap empty space (or call ref.spawnAt) to spawn; drag a noble onto the
 * top-right trash to remove it. Caps at maxCount (default 6).
 */
const WanderingNobles = forwardRef<WanderingNoblesHandle, WanderingNoblesProps>(
  function WanderingNobles(
    {
      initialCount = 2,
      size = 64,
      minSpeed = 0.35,
      maxSpeed = 0.7,
      maxCount = 6,
      captureClicks = true,
      style = {},
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const nobles = useRef<Noble[]>([])
    const sprites = useRef<HTMLImageElement[]>([])
    const dims = useRef({ W: 0, H: 0 })
    const raf = useRef(0)
    const drag = useRef<{
      index: number
      ox: number
      oy: number
      startX: number
      startY: number
      moved: boolean
    } | null>(null)
    const suppressClick = useRef(false)
    const [showTrash, setShowTrash] = useState(false)
    const [overTrash, setOverTrash] = useState(false)

    const localPoint = useCallback((clientX: number, clientY: number) => {
      const root = rootRef.current
      if (!root) return { x: 0, y: 0 }
      const r = root.getBoundingClientRect()
      return { x: clientX - r.left, y: clientY - r.top }
    }, [])

    const inTrash = useCallback((x: number, y: number) => {
      const { W } = dims.current
      const left = W - TRASH_PAD - TRASH_SIZE
      const top = TRASH_PAD
      return (
        x >= left &&
        x <= left + TRASH_SIZE &&
        y >= top &&
        y <= top + TRASH_SIZE
      )
    }, [])

    const hitTest = useCallback(
      (x: number, y: number) => {
        const list = nobles.current
        for (let i = list.length - 1; i >= 0; i--) {
          const n = list[i]
          if (
            x >= n.x &&
            x <= n.x + size &&
            y >= n.y &&
            y <= n.y + size
          ) {
            return i
          }
        }
        return -1
      },
      [size],
    )

    const spawn = useCallback(
      (x?: number, y?: number) => {
        if (nobles.current.length >= maxCount) return
        const { W, H } = dims.current
        const cx = x == null ? Math.random() * W : x
        const cy = y == null ? Math.random() * H : y
        const ang = Math.random() * Math.PI * 2
        const sp = minSpeed + Math.random() * (maxSpeed - minSpeed)
        nobles.current.push({
          x: Math.max(0, Math.min(W - size, cx - size / 2)),
          y: Math.max(0, Math.min(H - size, cy - size / 2)),
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          f: Math.floor(Math.random() * 4),
          t: 0,
          turn: 60 + Math.random() * 180,
          pop: 0,
        })
      },
      [size, minSpeed, maxSpeed, maxCount],
    )

    useImperativeHandle(
      ref,
      () => ({
        spawnRandom: () => spawn(),
        spawnAt: (e) => {
          const p = localPoint(e.clientX, e.clientY)
          spawn(p.x, p.y)
        },
        clear: () => {
          nobles.current = []
          drag.current = null
          setShowTrash(false)
          setOverTrash(false)
        },
      }),
      [spawn, localPoint],
    )

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const p = localPoint(e.clientX, e.clientY)
      const i = hitTest(p.x, p.y)
      if (i < 0) return
      const n = nobles.current[i]
      // Draw dragged noble on top
      nobles.current.splice(i, 1)
      nobles.current.push(n)
      const index = nobles.current.length - 1
      drag.current = {
        index,
        ox: p.x - n.x,
        oy: p.y - n.y,
        startX: p.x,
        startY: p.y,
        moved: false,
      }
      n.vx = 0
      n.vy = 0
      setShowTrash(true)
      setOverTrash(false)
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      const n = nobles.current[d.index]
      if (!n) return
      const { W, H } = dims.current
      const p = localPoint(e.clientX, e.clientY)
      if (
        !d.moved &&
        (Math.abs(p.x - d.startX) > DRAG_THRESHOLD ||
          Math.abs(p.y - d.startY) > DRAG_THRESHOLD)
      ) {
        d.moved = true
      }
      n.x = Math.max(0, Math.min(W - size, p.x - d.ox))
      n.y = Math.max(0, Math.min(H - size, p.y - d.oy))
      const cx = n.x + size / 2
      const cy = n.y + size / 2
      setOverTrash(inTrash(cx, cy) || inTrash(p.x, p.y))
    }

    const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      const n = nobles.current[d.index]
      const p = localPoint(e.clientX, e.clientY)
      const drop =
        n &&
        (inTrash(n.x + size / 2, n.y + size / 2) || inTrash(p.x, p.y))
      if (drop) {
        nobles.current.splice(d.index, 1)
      } else if (n) {
        const ang = Math.random() * Math.PI * 2
        const sp = minSpeed + Math.random() * (maxSpeed - minSpeed)
        n.vx = Math.cos(ang) * sp
        n.vy = Math.sin(ang) * sp
        n.turn = 60 + Math.random() * 180
      }
      if (d.moved) suppressClick.current = true
      drag.current = null
      setShowTrash(false)
      setOverTrash(false)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }

    const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      if (!captureClicks) return
      const p = localPoint(e.clientX, e.clientY)
      if (hitTest(p.x, p.y) >= 0) return
      spawn(p.x, p.y)
    }

    useEffect(() => {
      sprites.current = FRAMES.map((src) => {
        const im = new Image()
        im.src = src
        return im
      })
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      let alive = true

      const resize = () => {
        const root = rootRef.current
        if (!root) return
        const r = root.getBoundingClientRect()
        canvas.width = r.width
        canvas.height = r.height
        dims.current = { W: r.width, H: r.height }
        ctx.imageSmoothingEnabled = false
      }
      resize()
      window.addEventListener('resize', resize)

      const kickoff = () => {
        const s = sprites.current
        if (s.length && s.every((im) => im.complete && im.naturalWidth > 0)) {
          const n = Math.min(initialCount, maxCount)
          for (let i = 0; i < n; i++) spawn()
        } else setTimeout(kickoff, 60)
      }
      kickoff()

      const loop = () => {
        if (!alive) return
        const { W, H } = dims.current
        const s = sprites.current
        const draggingIndex = drag.current?.index ?? -1
        for (let i = 0; i < nobles.current.length; i++) {
          const n = nobles.current[i]
          n.pop = Math.min(1, n.pop + 0.06)
          if (i === draggingIndex) {
            if (++n.t >= 9) {
              n.t = 0
              n.f = (n.f + 1) & 3
            }
            continue
          }
          n.x += n.vx
          n.y += n.vy
          if (n.x < 0) {
            n.x = 0
            n.vx = Math.abs(n.vx)
          }
          if (n.x > W - size) {
            n.x = W - size
            n.vx = -Math.abs(n.vx)
          }
          if (n.y < 0) {
            n.y = 0
            n.vy = Math.abs(n.vy)
          }
          if (n.y > H - size) {
            n.y = H - size
            n.vy = -Math.abs(n.vy)
          }
          if (--n.turn <= 0) {
            const a = Math.random() * Math.PI * 2
            const sp = minSpeed + Math.random() * (maxSpeed - minSpeed)
            n.vx = Math.cos(a) * sp
            n.vy = Math.sin(a) * sp
            n.turn = 60 + Math.random() * 180
          }
          if (++n.t >= 9) {
            n.t = 0
            n.f = (n.f + 1) & 3
          }
        }
        ctx.clearRect(0, 0, W, H)
        for (const n of nobles.current) {
          const im = s[n.f]
          if (!im || !im.complete) continue
          const w = size * n.pop
          const h = size * n.pop
          ctx.save()
          ctx.translate(n.x + size / 2, n.y + size / 2)
          if (n.vx < 0) ctx.scale(-1, 1)
          ctx.drawImage(im, -w / 2, -h / 2, w, h)
          ctx.restore()
        }
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)

      return () => {
        alive = false
        cancelAnimationFrame(raf.current)
        window.removeEventListener('resize', resize)
      }
    }, [initialCount, size, minSpeed, maxSpeed, maxCount, spawn])

    return (
      <div
        ref={rootRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={onClick}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'auto',
          touchAction: 'none',
          cursor: showTrash ? 'grabbing' : 'pointer',
          ...style,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            imageRendering: 'pixelated',
            pointerEvents: 'none',
          }}
        />
        {showTrash && (
          <div
            aria-label="Remove noble"
            style={{
              position: 'absolute',
              top: TRASH_PAD,
              right: TRASH_PAD,
              width: TRASH_SIZE,
              height: TRASH_SIZE,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: overTrash ? '#C05A3C' : 'rgba(255,255,255,0.92)',
              boxShadow: overTrash
                ? '0 8px 22px rgba(192,90,60,.45)'
                : '0 6px 18px rgba(26,24,20,.18)',
              transform: overTrash ? 'scale(1.12)' : 'scale(1)',
              transition:
                'transform .15s ease, background .15s ease, box-shadow .15s ease',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <TrashIcon active={overTrash} />
          </div>
        )}
      </div>
    )
  },
)

export default WanderingNobles
