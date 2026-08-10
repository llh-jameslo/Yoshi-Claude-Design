import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type Ref,
} from 'react'
import * as THREE from 'three'
import { hashString, mulberry32 } from './memories'

export type GrassGlobeFlower = {
  id: string
  name: string
  ts: string
  /** Permanent position index. A slot's spot on the globe never changes. */
  slot: number
  /** 0-4; falls back to a hash of the id. */
  species?: number
}

export type GrassGlobeOptions = {
  radius: number
  blades: number
  density: number
  minBlades: number
  segments: number
  length: number
  idleSpin: number
  width: number
  zoom: number
  zoomMin: number
  zoomMax: number
  stemHeight: number
  flowerSize: number
}

type CreateOptions = Partial<GrassGlobeOptions> & {
  flowers: GrassGlobeFlower[]
  onFlowerTap: ((flower: GrassGlobeFlower) => void) | null
  tipEl: HTMLElement | null
  tipHeadEl: HTMLElement | null
  tipTimeEl: HTMLElement | null
  hintEl: HTMLElement | null
}

export type GrassGlobeHandle = {
  dispose: () => void
  /** Diffs by id so planting doesn't disturb the flowers already growing. */
  syncFlowers: (next: GrassGlobeFlower[]) => void
  /** Turns the globe until the flower faces the camera. */
  focusFlower: (id: string) => void
}

type RGB = [number, number, number]

type MeshBuffers = {
  pos: number[]
  col: number[]
  idx: number[]
}

type PetalParams = {
  z0: number
  rot: number
  len: number
  wid: number
  cup: number
  lift: number
  droop: number
  c0: RGB
  c1: RGB
}

type Species = {
  name: string
  petals: number
  rings: number
  len: number
  wid: number
  cup: number
  lift: number
  droop: number
  c0: string
  c1: string
  heart: [string, string]
  hr: number
  hh: number
}

type FlowerEntry = {
  data: GrassGlobeFlower
  dir: THREE.Vector3
  flower: THREE.Mesh
  pick: THREE.Mesh
  /** 0 while blooming in, 1 once fully grown. */
  bloom: number
}

/**
 * Radical inverse in base 2. Any prefix of the sequence is evenly spread, so
 * the garden looks well distributed at one flower and at fifty, and a slot's
 * latitude never shifts as new memories arrive.
 */
function radicalInverse2(i: number) {
  let bits = i >>> 0
  let r = 0
  let f = 0.5
  while (bits) {
    r += (bits & 1) * f
    bits >>>= 1
    f *= 0.5
  }
  return r
}

function slotDirection(slot: number) {
  const y = 1 - 2 * radicalInverse2(slot + 1)
  const rr = Math.sqrt(Math.max(0, 1 - y * y))
  // Offset so slot 0 lands on the equator facing the camera: the very first
  // memory greets you instead of hiding round the back.
  const th = slot * 2.39996 + Math.PI / 2
  return new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).normalize()
}

const DEFAULTS: GrassGlobeOptions = {
  radius: 1.0,
  blades: 100000, // hard ceiling on blades ever drawn
  density: 0.24, // how thick the grass stays as you zoom out
  minBlades: 14000,
  segments: 4, // vertical segments per blade
  length: 0.2, // blade length at scale 1
  idleSpin: 0, // set to ~0.00018 to bring back the slow drift
  width: 0.013, // blade width at the base
  zoom: 4.6, // camera distance at rest
  zoomMin: 3.0, // closest (biggest globe)
  zoomMax: 9.5, // furthest (smallest globe)
  stemHeight: 1.25, // 1.0 = stem exactly as tall as the grass
  flowerSize: 1.0, // 1.0 = default head size
}

function createGrassGlobe(
  container: HTMLElement,
  options: CreateOptions,
): GrassGlobeHandle {
  const opt = { ...DEFAULTS, ...options }

  const R = opt.radius

  // ================================================================ renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setClearColor(0x000000, 0)
  // The palette was tuned against three's older linear output; keep it there
  // so the greens read the same under the modern sRGB default.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.domElement.classList.add('gg-canvas')
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(0, 0, opt.zoom)

  const globe = new THREE.Group()
  scene.add(globe)

  const LIGHT = new THREE.Vector3(-0.55, 0.85, 0.6).normalize()

  // ============================================================= bend field
  // A lat/long map of the sphere. Each texel holds one patch's bend (rg) and
  // velocity (ba) and integrates its own damped spring every frame, so the
  // grass remembers being brushed and recovers patch by patch. This is the
  // cheap stand-in for the per-blade state buffers a compute shader would give.
  const FW = 1024
  const FH = 512 // fine enough that a 0.05 parting keeps a crisp edge
  const fieldOpts: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  }
  let fieldA = new THREE.WebGLRenderTarget(FW, FH, fieldOpts)
  let fieldB = new THREE.WebGLRenderTarget(FW, FH, fieldOpts)

  const fieldUniforms = {
    uPrev: { value: null as THREE.Texture | null },
    uHitDir: { value: new THREE.Vector3(0, 0, 1) },
    uPush: { value: new THREE.Vector3() },
    uStamp: { value: 0 },
    uR: { value: 0.075 }, // size of the parted patch, in radians
    uDt: { value: 0.016 },
  }

  const fieldMat = new THREE.ShaderMaterial({
    uniforms: fieldUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uPrev;
      uniform vec3  uHitDir;
      uniform vec3  uPush;
      uniform float uStamp;
      uniform float uR;
      uniform float uDt;
      varying vec2 vUv;

      void main(){
        float lon = (vUv.x - 0.5) * 6.28318531;
        float lat = (vUv.y - 0.5) * 3.14159265;
        vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));

        vec3 east  = normalize(cross(vec3(0.0, 1.0, 0.0), d) + vec3(1e-5, 0.0, 0.0));
        vec3 north = cross(d, east);

        vec4 prev = texture2D(uPrev, vUv);
        vec2 x = prev.rg * 2.0 - 1.0;
        vec2 v = prev.ba * 2.0 - 1.0;

        float ang = acos(clamp(dot(d, uHitDir), -1.0, 1.0));
        float hit = exp(-(ang * ang) / (uR * uR)) * uStamp;

        // Everything under the cursor leans directly away from it, so the
        // grass parts outward in every direction like a finger pressed in.
        vec3 toward = normalize(uHitDir - d * dot(uHitDir, d) + vec3(1e-6));
        vec2 dir = -vec2(dot(toward, east), dot(toward, north));

        float dt = min(uDt, 0.033);

        x = mix(x, dir * 0.85, clamp(hit * 0.7, 0.0, 1.0));
        v += dir * hit * 3.5 * dt;        // a small kick, so it springs open

        v += (-x * 58.0) * dt;            // spring back to standing
        v *= exp(-3.4 * dt);
        x += v * dt;
        x *= exp(-0.45 * dt);

        gl_FragColor = vec4(clamp(x, -1.0, 1.0) * 0.5 + 0.5,
                            clamp(v, -1.0, 1.0) * 0.5 + 0.5);
      }
    `,
  })

  const fieldScene = new THREE.Scene()
  const fieldCam = new THREE.Camera()
  const fieldQuadGeo = new THREE.PlaneGeometry(1, 1)
  fieldScene.add(new THREE.Mesh(fieldQuadGeo, fieldMat))

  renderer.setClearColor(new THREE.Color(0.5, 0.5, 0.5), 0.5)
  ;[fieldA, fieldB].forEach(function (rt) {
    renderer.setRenderTarget(rt)
    renderer.clear(true, false, false)
  })
  renderer.setRenderTarget(null)
  renderer.setClearColor(0x000000, 0)

  // ============================================================== the grass
  const U = {
    uRadius: { value: R },
    uLen: { value: opt.length },
    uWidth: { value: opt.width },
    uTime: { value: 0 },
    uGravity: { value: new THREE.Vector3(0, -0.42, 0) },
    uWindDir: { value: new THREE.Vector3(1, 0.22, 0).normalize() },
    uSpin: { value: new THREE.Vector3() },
    uField: { value: fieldA.texture as THREE.Texture },
    uFieldAmt: { value: 0.45 }, // how far a parted blade leans
    uWidthScale: { value: 1 },
    uLight: { value: LIGHT },
  }

  // one blade = a tapered strip; the shader places and bends it
  function bladeGeometry(seg: number, count: number) {
    const av: number[] = []
    const aside: number[] = []
    const pos: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= seg; i++) {
      const v = i / seg
      av.push(v, v)
      aside.push(-1, 1)
      pos.push(0, 0, 0, 0, 0, 0)
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3
      idx.push(a, c, b, b, c, d)
    }
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aV', new THREE.Float32BufferAttribute(av, 1))
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(aside, 1))
    g.setIndex(idx)

    // one blade per instance, spread by a fibonacci spiral then jittered
    const roots = new Float32Array(count * 3)
    const rnd = new Float32Array(count * 4)
    const GA = Math.PI * (3 - Math.sqrt(5))
    const jitter = 0.75 * Math.sqrt((4 * Math.PI) / count)
    for (let i = 0; i < count; i++) {
      const y = 1 - ((i + 0.5) / count) * 2
      const rr = Math.sqrt(Math.max(0, 1 - y * y))
      const th = i * GA
      let x = Math.cos(th) * rr,
        z = Math.sin(th) * rr,
        yy = y
      x += (Math.random() - 0.5) * jitter
      yy += (Math.random() - 0.5) * jitter
      z += (Math.random() - 0.5) * jitter
      const inv = 1 / Math.hypot(x, yy, z)
      roots[i * 3] = x * inv
      roots[i * 3 + 1] = yy * inv
      roots[i * 3 + 2] = z * inv

      rnd[i * 4] = Math.random() // facing angle
      rnd[i * 4 + 1] = Math.random() // length / width scale
      rnd[i * 4 + 2] = Math.random() // tint + wind phase
      rnd[i * 4 + 3] = Math.random() // stiffness
    }

    // Shuffle. The fibonacci spiral walks pole to pole, so the first N
    // instances would be a polar cap. Shuffled, any prefix of the list is an
    // even covering of the whole sphere — which is what lets us drop the
    // instance count for LOD and still have grass everywhere.
    for (let i = count - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0
      for (let k = 0; k < 3; k++) {
        const t = roots[i * 3 + k]
        roots[i * 3 + k] = roots[j * 3 + k]
        roots[j * 3 + k] = t
      }
      for (let k = 0; k < 4; k++) {
        const t = rnd[i * 4 + k]
        rnd[i * 4 + k] = rnd[j * 4 + k]
        rnd[j * 4 + k] = t
      }
    }
    g.setAttribute('aRoot', new THREE.InstancedBufferAttribute(roots, 3))
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4))
    g.instanceCount = count
    g.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      R + opt.length * 2,
    )
    return g
  }

  const GRASS_VERT = `
    attribute float aV;
    attribute float aSide;
    attribute vec3  aRoot;
    attribute vec4  aRand;

    uniform float uRadius;
    uniform float uLen;
    uniform float uWidth;
    uniform float uWidthScale;
    uniform float uTime;
    uniform vec3  uGravity;
    uniform vec3  uWindDir;
    uniform vec3  uSpin;
    uniform sampler2D uField;
    uniform float uFieldAmt;

    varying float vV;
    varying float vTint;
    varying vec3  vN;

    void main(){
      vec3 n = normalize(aRoot);

      // local frame at the root
      vec3 e = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-5, 0.0, 0.0));
      vec3 f = cross(n, e);

      float ang  = aRand.x * 6.28318531;
      vec3  wdir = e * cos(ang) + f * sin(ang);        // width runs this way
      float len  = uLen * (0.55 + 0.9 * aRand.y);
      float stif = 0.65 + 0.8 * aRand.w;

      // --- forces, all tangent to the sphere ---
      vec3 g = uGravity - n * dot(uGravity, n);

      vec3 wt = normalize(uWindDir - n * dot(uWindDir, n) + vec3(1e-5));
      float ph = dot(n, uWindDir) * 5.5 - uTime * 1.15 + aRand.z * 1.2;
      float gust = sin(ph) * 0.62 + sin(ph * 1.9 + 1.7) * 0.38;
      vec3 windBend = wt * (0.05 + 0.15 * (gust * 0.5 + 0.5));

      vec3 lag = cross(uSpin, n);
      lag -= n * dot(lag, n);

      vec2 fuv = vec2(atan(n.z, n.x) * 0.15915494 + 0.5,
                      asin(clamp(n.y, -1.0, 1.0)) * 0.31830989 + 0.5);
      vec2 fx = texture2D(uField, fuv).rg * 2.0 - 1.0;
      vec3 combed = (e * fx.x + f * fx.y) * uFieldAmt;

      vec3 bend = (g + windBend - lag + combed) / stif;

      // --- lay the blade out ---
      float v = aV;
      float halfW = uWidth * uWidthScale * (0.7 + 0.6 * aRand.y) * pow(1.0 - v, 0.55) * 0.5;
      vec3 p = n * uRadius + n * (len * v) + bend * (len * v * v) + wdir * (aSide * halfW);

      // normal, rounded across the width so blades read as blades not ribbons
      vec3 tang = normalize(n * len + bend * (len * 2.0 * v) + vec3(1e-6));
      vec3 nrm  = normalize(cross(tang, wdir) + wdir * aSide * 0.45);

      vV = v;
      vTint = aRand.z;
      vN = normalize(mat3(modelMatrix) * nrm);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `

  const GRASS_FRAG = `
    precision highp float;
    uniform vec3 uLight;
    varying float vV;
    varying float vTint;
    varying vec3  vN;

    void main(){
      vec3 N = normalize(vN);
      if (!gl_FrontFacing) N = -N;

      vec3 dark = vec3(0.055, 0.170, 0.030);
      vec3 mid  = vec3(0.230, 0.470, 0.075);
      vec3 tip  = vec3(0.580, 0.820, 0.240);
      vec3 col = vV < 0.55 ? mix(dark, mid, vV / 0.55)
                           : mix(mid, tip, (vV - 0.55) / 0.45);

      col *= 0.84 + 0.32 * vTint;
      col *= mix(0.76, 1.0, pow(vV, 0.80));            // a touch of shade at the roots

      float lam   = clamp(dot(N, uLight), 0.0, 1.0);
      float trans = pow(clamp(dot(-N, uLight), 0.0, 1.0), 2.0);  // light through the blade
      float sky   = 0.5 + 0.5 * N.y;
      col *= 0.84 + 0.40 * lam + 0.20 * trans + 0.08 * sky;

      gl_FragColor = vec4(col, 1.0);
    }
  `

  const grassMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: GRASS_VERT,
    fragmentShader: GRASS_FRAG,
    side: THREE.DoubleSide,
  })

  const grassGeo = bladeGeometry(opt.segments, opt.blades)
  const grassMesh = new THREE.Mesh(grassGeo, grassMat)
  grassMesh.frustumCulled = false
  globe.add(grassMesh)

  // dark soil underneath, so gaps between blades read as shadow
  const coreGeo = new THREE.IcosahedronGeometry(R * 0.998, 4)
  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT } },
    vertexShader: `
      varying vec3 vN;
      void main(){
        vN = normalize(mat3(modelMatrix) * normalize(position));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uLight;
      varying vec3 vN;
      void main(){
        float lam = clamp(dot(normalize(vN), uLight), 0.0, 1.0);
        gl_FragColor = vec4(vec3(0.185, 0.360, 0.085) * (0.88 + 0.34 * lam), 1.0);
      }
    `,
  })
  const core = new THREE.Mesh(coreGeo, coreMat)
  globe.add(core)

  // =============================================================== flowers
  // Real petal geometry rather than a painted plane: each petal is a curved
  // strip that lifts off the surface, cups across its width and droops at the
  // tip, so the flowers catch the same light as the grass and turn with it.
  const hex = function (h: string): RGB {
    return [
      parseInt(h.slice(1, 3), 16) / 255,
      parseInt(h.slice(3, 5), 16) / 255,
      parseInt(h.slice(5, 7), 16) / 255,
    ]
  }

  function addPetal(out: MeshBuffers, p: PetalParams) {
    const NV = 7,
      NU = 4
    const base = out.pos.length / 3
    const cs = Math.cos(p.rot),
      sn = Math.sin(p.rot)
    for (let iv = 0; iv <= NV; iv++) {
      const u = iv / NV
      const hw =
        p.wid * 0.5 * (0.16 + 0.84 * Math.sin(Math.pow(u, 0.72) * Math.PI))
      const y = u * p.len
      const z = p.z0 + p.len * (p.lift * u - p.droop * u * u)
      const cm = Math.min(1, Math.max(0, (u - 0.04) / 0.66))
      for (let iu = 0; iu <= NU; iu++) {
        const t = (iu / NU) * 2 - 1
        const x = t * hw
        const zz = z - p.cup * hw * t * t
        out.pos.push(x * cs - y * sn, x * sn + y * cs, zz)
        // pale at the throat, saturated toward the tip
        for (let k = 0; k < 3; k++)
          out.col.push(p.c0[k] + (p.c1[k] - p.c0[k]) * cm)
      }
    }
    for (let iv = 0; iv < NV; iv++) {
      for (let iu = 0; iu < NU; iu++) {
        const a = base + iv * (NU + 1) + iu,
          b = a + 1,
          c = a + (NU + 1),
          d = c + 1
        out.idx.push(a, c, b, b, c, d)
      }
    }
  }

  function addStem(out: MeshBuffers, h: number, cA: RGB, cB: RGB) {
    const SEG = 6,
      RINGS = 3
    const base = out.pos.length / 3
    for (let i = 0; i <= RINGS; i++) {
      const t = i / RINGS
      const r = 0.0062 * (1 - 0.35 * t)
      for (let j = 0; j <= SEG; j++) {
        const a = (j / SEG) * Math.PI * 2
        out.pos.push(Math.cos(a) * r, Math.sin(a) * r, t * h)
        for (let c = 0; c < 3; c++) out.col.push(cA[c] + (cB[c] - cA[c]) * t)
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SEG; j++) {
        const a = base + i * (SEG + 1) + j,
          b = a + 1,
          c = a + (SEG + 1),
          d = c + 1
        out.idx.push(a, c, b, b, c, d)
      }
    }
  }

  function addCentre(
    out: MeshBuffers,
    r: number,
    h: number,
    z0: number,
    cA: RGB,
    cB: RGB,
  ) {
    const RINGS = 4,
      SEGS = 14
    const base = out.pos.length / 3
    for (let i = 0; i <= RINGS; i++) {
      const rr = i / RINGS
      for (let j = 0; j <= SEGS; j++) {
        const a = (j / SEGS) * Math.PI * 2
        out.pos.push(
          Math.cos(a) * rr * r,
          Math.sin(a) * rr * r,
          z0 + h * (1 - rr * rr),
        )
        // speckle, so the middle reads as stamens not a flat dot
        const k = Math.min(1, (1 - rr) * 0.55 + Math.random() * 0.45)
        for (let c = 0; c < 3; c++) out.col.push(cA[c] + (cB[c] - cA[c]) * k)
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SEGS; j++) {
        const a = base + i * (SEGS + 1) + j,
          b = a + 1,
          c = a + (SEGS + 1),
          d = c + 1
        out.idx.push(a, c, b, b, c, d)
      }
    }
  }

  const SPECIES: Species[] = [
    {
      name: 'blossom',
      petals: 5,
      rings: 1,
      len: 0.085,
      wid: 0.075,
      cup: 0.3,
      lift: 0.34,
      droop: 0.26,
      c0: '#ffffff',
      c1: '#f19cbe',
      heart: ['#e8a11c', '#fff3bd'],
      hr: 0.02,
      hh: 0.01,
    },
    {
      name: 'daisy',
      petals: 13,
      rings: 1,
      len: 0.09,
      wid: 0.03,
      cup: 0.18,
      lift: 0.3,
      droop: 0.34,
      c0: '#ffffff',
      c1: '#f3f2ff',
      heart: ['#efb01e', '#fff0a8'],
      hr: 0.026,
      hh: 0.012,
    },
    {
      name: 'dahlia',
      petals: 8,
      rings: 2,
      len: 0.078,
      wid: 0.048,
      cup: 0.34,
      lift: 0.4,
      droop: 0.22,
      c0: '#f6e8ff',
      c1: '#a487dd',
      heart: ['#e0d24a', '#fffbcf'],
      hr: 0.016,
      hh: 0.01,
    },
    {
      name: 'buttercup',
      petals: 5,
      rings: 1,
      len: 0.072,
      wid: 0.07,
      cup: 0.52,
      lift: 0.46,
      droop: 0.14,
      c0: '#fff4c9',
      c1: '#f0a92c',
      heart: ['#b98617', '#ffe7a0'],
      hr: 0.017,
      hh: 0.011,
    },
    {
      name: 'aster',
      petals: 11,
      rings: 2,
      len: 0.082,
      wid: 0.032,
      cup: 0.2,
      lift: 0.32,
      droop: 0.3,
      c0: '#ffffff',
      c1: '#e79ac2',
      heart: ['#d99a22', '#fff2b8'],
      hr: 0.02,
      hh: 0.011,
    },
  ]

  // Seeded off the memory id so a flower keeps its exact face forever.
  function flowerGeometry(sp: Species, stemH: number, rnd: () => number) {
    const out: MeshBuffers = { pos: [], col: [], idx: [] }
    const c0 = hex(sp.c0),
      c1 = hex(sp.c1)
    const spin = rnd() * Math.PI * 2

    addStem(out, stemH, hex('#4e7a2c'), hex('#7fac4a'))

    for (let ring = 0; ring < sp.rings; ring++) {
      const k = ring === 0 ? 1 : 0.72 // inner ring is smaller
      const n = ring === 0 ? sp.petals : Math.max(3, Math.round(sp.petals * 0.7))
      for (let i = 0; i < n; i++) {
        addPetal(out, {
          z0: stemH,
          rot: spin + (i / n) * Math.PI * 2 + ring * 0.4 + (rnd() - 0.5) * 0.1,
          len: sp.len * k * (0.9 + rnd() * 0.2),
          wid: sp.wid * k * (0.9 + rnd() * 0.2),
          cup: sp.cup,
          lift: sp.lift + ring * 0.22 + (rnd() - 0.5) * 0.06,
          droop: sp.droop,
          c0: c0,
          c1: c1,
        })
      }
    }
    addCentre(out, sp.hr, sp.hh, stemH, hex(sp.heart[0]), hex(sp.heart[1]))

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(out.col, 3))
    g.setIndex(out.idx)
    g.computeVertexNormals()
    return g
  }

  const flowerMat = new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT } },
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aColor;
      varying vec3 vC;
      varying vec3 vN;
      void main(){
        vC = aColor;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uLight;
      varying vec3 vC;
      varying vec3 vN;
      void main(){
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) N = -N;
        float lam   = clamp(dot(N, uLight), 0.0, 1.0);
        float trans = pow(clamp(dot(-N, uLight), 0.0, 1.0), 1.5);  // petals are thin
        gl_FragColor = vec4(vC * (0.72 + 0.34 * lam + 0.26 * trans), 1.0);
      }
    `,
  })

  const flowerMeshes: THREE.Mesh[] = []
  const entries = new Map<THREE.Object3D, FlowerEntry>()
  const pickGeo = new THREE.SphereGeometry(0.085, 8, 6)
  const pickMat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
  })

  const byId = new Map<string, FlowerEntry>()
  const stemH = opt.length * opt.stemHeight
  const BLOOM_SECONDS = 0.7

  function addFlower(data: GrassGlobeFlower, bloom: number) {
    const dir = slotDirection(data.slot)
    const seed = hashString(data.id)
    const sp = SPECIES[(data.species ?? seed) % SPECIES.length]

    const m = new THREE.Mesh(
      flowerGeometry(sp, stemH, mulberry32(seed)),
      flowerMat,
    )
    m.scale.setScalar(opt.flowerSize * bloom)
    m.position.copy(dir).multiplyScalar(R - opt.length * 0.05)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    globe.add(m)

    // a slightly generous invisible target on the head, so it stays tappable
    const pick = new THREE.Mesh(pickGeo, pickMat)
    pick.position.copy(dir).multiplyScalar(R + stemH * opt.flowerSize)
    globe.add(pick)

    const entry: FlowerEntry = { data, dir, flower: m, pick, bloom }
    entries.set(pick, entry)
    byId.set(data.id, entry)
    flowerMeshes.push(pick)
    return entry
  }

  function removeFlower(entry: FlowerEntry) {
    globe.remove(entry.flower)
    globe.remove(entry.pick)
    entry.flower.geometry.dispose()
    entries.delete(entry.pick)
    byId.delete(entry.data.id)
    const i = flowerMeshes.indexOf(entry.pick)
    if (i >= 0) flowerMeshes.splice(i, 1)
    if (activeFlower === entry.pick) closeTip()
  }

  function syncFlowers(next: GrassGlobeFlower[]) {
    const keep = new Set(next.map((f) => f.id))
    byId.forEach((entry, id) => {
      if (!keep.has(id)) removeFlower(entry)
    })
    next.forEach((data) => {
      const existing = byId.get(data.id)
      // Only the copy can change in place; slot and species are permanent.
      if (existing) existing.data = data
      else addFlower(data, 0)
    })
  }

  opt.flowers.forEach((data) => addFlower(data, 1))

  // =============================================================== tooltip
  const tipEl = options.tipEl
  const tipH = options.tipHeadEl
  const tipT = options.tipTimeEl
  const hintEl = options.hintEl
  let activeFlower: THREE.Mesh | null = null

  function openTip(mesh: THREE.Mesh) {
    const entry = entries.get(mesh)
    if (!entry) return
    activeFlower = mesh
    if (tipH) tipH.textContent = entry.data.name
    if (tipT) tipT.textContent = entry.data.ts
    if (tipEl) tipEl.classList.add('show')
    if (opt.onFlowerTap) opt.onFlowerTap(entry.data)
  }
  function closeTip() {
    activeFlower = null
    if (tipEl) tipEl.classList.remove('show')
  }

  // ================================================================= input
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const brushSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, 0),
    R + opt.length * 0.5,
  )

  let dragging = false,
    dragDist = 0,
    px = 0,
    py = 0
  let spinX = 0,
    spinY = 0,
    stampAmt = 0
  const IDLE_SPIN = opt.idleSpin

  const tmpV = new THREE.Vector3()
  const hitW = new THREE.Vector3()
  const hitA = new THREE.Vector3()
  const qTmp = new THREE.Quaternion()
  const el = renderer.domElement

  function setNDC(e: PointerEvent) {
    const r = el.getBoundingClientRect()
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }

  // The cursor parts the grass wherever it sits, moving or not, so we just
  // remember where it is and re-stamp every frame.
  const cursor = new THREE.Vector2()
  let cursorOn = false

  function trackCursor(e: PointerEvent) {
    setNDC(e)
    cursor.copy(ndc)
    cursorOn = true
  }

  function stampCursor() {
    if (!cursorOn) {
      stampAmt = 0
      return
    }
    ray.setFromCamera(cursor, camera)
    if (!ray.ray.intersectSphere(brushSphere, hitW)) {
      stampAmt = 0
      return
    }
    hitA.copy(hitW)
    globe.worldToLocal(hitA)
    fieldUniforms.uHitDir.value.copy(hitA).normalize()
    stampAmt = dragging ? 1.0 : 0.8
  }

  // Set by focusFlower; any touch hands control straight back to the user.
  let focusQ: THREE.Quaternion | null = null

  function focusFlower(id: string) {
    const entry = byId.get(id)
    if (!entry) return
    focusQ = new THREE.Quaternion().setFromUnitVectors(
      entry.dir,
      new THREE.Vector3(0, 0, 1),
    )
  }

  function onDown(e: PointerEvent) {
    dragging = true
    dragDist = 0
    focusQ = null
    px = e.clientX
    py = e.clientY
    el.classList.add('grabbing')
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    trackCursor(e)
    if (hintEl) hintEl.style.opacity = '0'
  }
  function onMove(e: PointerEvent) {
    const dx = e.clientX - px,
      dy = e.clientY - py
    if (dragging) {
      dragDist += Math.hypot(dx, dy)
      const CAP = 0.028
      spinY = Math.max(-CAP, Math.min(CAP, spinY + dx * 0.00034))
      spinX = Math.max(-CAP, Math.min(CAP, spinX + dy * 0.00034))
    }
    trackCursor(e)
    px = e.clientX
    py = e.clientY
  }
  function onUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    el.classList.remove('grabbing')
    if (dragDist < 6) {
      setNDC(e)
      ray.setFromCamera(ndc, camera)
      const hits = ray
        .intersectObjects(flowerMeshes, false)
        .filter(function (h) {
          return h.object.visible
        })
      if (hits.length) openTip(hits[0].object as THREE.Mesh)
      else closeTip()
    }
  }
  function onCancel() {
    dragging = false
    el.classList.remove('grabbing')
  }
  function onLeave() {
    cursorOn = false
    stampAmt = 0
  }

  let zoomTarget = opt.zoom
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    zoomTarget = Math.max(
      opt.zoomMin,
      Math.min(opt.zoomMax, zoomTarget * Math.exp(e.deltaY * 0.0011)),
    )
    if (hintEl) hintEl.style.opacity = '0'
  }

  // pinch to zoom on touch
  const pointers = new Map<number, { x: number; y: number }>()
  let pinchStart = 0,
    pinchZoom0 = 0
  function pinchDist() {
    const p = [...pointers.values()]
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
  }
  function onDown2(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      pinchStart = pinchDist()
      pinchZoom0 = zoomTarget
      dragging = false
    }
  }
  function onMove2(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2 && pinchStart > 0) {
      const k = pinchDist() / pinchStart
      zoomTarget = Math.max(opt.zoomMin, Math.min(opt.zoomMax, pinchZoom0 / k))
    }
  }
  function onUp2(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchStart = 0
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onCancel)
  el.addEventListener('pointerleave', onLeave)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointerdown', onDown2)
  el.addEventListener('pointermove', onMove2)
  el.addEventListener('pointerup', onUp2)
  el.addEventListener('pointercancel', onUp2)

  // ================================================================== loop
  const camDir = new THREE.Vector3()
  const camRight = new THREE.Vector3()
  const camUp = new THREE.Vector3()
  const nrmW = new THREE.Vector3(),
    proj = new THREE.Vector3(),
    fPos = new THREE.Vector3()
  const invQ = new THREE.Quaternion()
  const gWorld = new THREE.Vector3(0, -0.42, 0)
  const windW = new THREE.Vector3()
  const omegaW = new THREE.Vector3(),
    omegaS = new THREE.Vector3()
  const omegaV = new THREE.Vector3(),
    dOmega = new THREE.Vector3()

  function placeHint() {
    if (!hintEl) return
    const h = container.clientHeight
    if (!h) return
    // Pin under the *default* framing so the line doesn't chase zoom.
    const fovR = (camera.fov * Math.PI) / 180
    const worldR = R + opt.length * 0.55
    const screenR =
      ((worldR / opt.zoom) * (h * 0.5)) / Math.tan(fovR * 0.5)
    const top = Math.round(h * 0.5 + screenR + 14)
    container.style.setProperty('--gg-hint-top', `${top}px`)
  }

  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    updateLOD()
    placeHint()
  }
  // Blades are budgeted by how much *screen* the globe covers, not by how big
  // it is in world units. Zoom out and the instance count drops with the area,
  // which is where the frame time goes.
  function updateLOD() {
    const h = el.clientHeight || 1
    const fovR = (camera.fov * Math.PI) / 180
    const screenR = ((R / camera.position.z) * (h * 0.5)) / Math.tan(fovR * 0.5)
    const area = Math.PI * screenR * screenR
    const want = Math.max(
      opt.minBlades,
      Math.min(opt.blades, Math.round(area * opt.density)),
    )
    grassGeo.instanceCount = want
    // fewer blades -> widen them so no soil shows through
    U.uWidthScale.value = Math.min(2.4, Math.sqrt(opt.blades / want))
  }

  window.addEventListener('resize', resize)
  // The phone frame can resize without the window doing so (pager, rotation)
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()
  camera.updateMatrixWorld()
  camRight.setFromMatrixColumn(camera.matrixWorld, 0)
  camUp.setFromMatrixColumn(camera.matrixWorld, 1)

  let raf = 0,
    t0 = performance.now(),
    alive = true

  function frame(now: number) {
    if (!alive) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - t0) / 16.667, 3)
    const dtSec = Math.min((now - t0) / 1000, 0.05)
    t0 = now

    U.uTime.value = now * 0.001

    // ease toward the zoom target, then rebudget the grass
    if (Math.abs(zoomTarget - camera.position.z) > 0.0005) {
      camera.position.z +=
        (zoomTarget - camera.position.z) * (1 - Math.pow(0.8, dt))
      camera.updateMatrixWorld()
      updateLOD()
    }

    if (!dragging) {
      spinY += IDLE_SPIN * dt * 0.35
      spinX *= Math.pow(0.94, dt)
      spinY *= Math.pow(0.94, dt)
    }
    if (Math.abs(spinX) > 1e-6 || Math.abs(spinY) > 1e-6) {
      qTmp.setFromAxisAngle(camUp, spinY * dt)
      globe.quaternion.premultiply(qTmp)
      qTmp.setFromAxisAngle(camRight, spinX * dt)
      globe.quaternion.premultiply(qTmp)
    }

    if (focusQ) {
      globe.quaternion.slerp(focusQ, 1 - Math.pow(0.86, dt))
      if (globe.quaternion.angleTo(focusQ) < 0.002) {
        globe.quaternion.copy(focusQ)
        focusQ = null
      }
    }

    invQ.copy(globe.quaternion).invert()
    U.uGravity.value.copy(gWorld).applyQuaternion(invQ)

    const wa = now * 0.00006
    windW.set(Math.cos(wa), 0.22, Math.sin(wa)).normalize()
    U.uWindDir.value.copy(windW).applyQuaternion(invQ)

    // blades trail the rotation on a spring, then swing back when it stops
    omegaW.copy(camRight).multiplyScalar(spinX).addScaledVector(camUp, spinY)
    dOmega.copy(omegaW).sub(omegaS)
    omegaV.addScaledVector(dOmega, 0.2 * dt).multiplyScalar(Math.pow(0.86, dt))
    omegaS.addScaledVector(omegaV, dt)
    U.uSpin.value.copy(omegaS).multiplyScalar(26).applyQuaternion(invQ)

    // step the bend field
    stampCursor()
    fieldUniforms.uPrev.value = fieldA.texture
    fieldUniforms.uStamp.value = stampAmt
    fieldUniforms.uDt.value = dtSec
    renderer.setRenderTarget(fieldB)
    renderer.render(fieldScene, fieldCam)
    renderer.setRenderTarget(null)
    const swap = fieldA
    fieldA = fieldB
    fieldB = swap
    U.uField.value = fieldA.texture
    stampAmt = 0

    globe.updateMatrixWorld()
    camera.getWorldPosition(camDir)

    // the soil sphere hides anything round the back; just skip those
    for (let i = 0; i < flowerMeshes.length; i++) {
      const pick = flowerMeshes[i]
      const entry = entries.get(pick)
      if (!entry) continue

      if (entry.bloom < 1) {
        entry.bloom = Math.min(1, entry.bloom + dtSec / BLOOM_SECONDS)
        // overshoot a touch on the way up so it springs open
        const e = 1 - Math.pow(1 - entry.bloom, 3)
        const overshoot = 1 + 0.16 * Math.sin(Math.PI * entry.bloom)
        entry.flower.scale.setScalar(opt.flowerSize * e * overshoot)
      }

      nrmW.copy(entry.dir).applyQuaternion(globe.quaternion)
      pick.getWorldPosition(fPos)
      const facing = nrmW.dot(tmpV.copy(camDir).sub(fPos).normalize()) > -0.15
      pick.visible = facing
      entry.flower.visible = facing
    }

    if (activeFlower) {
      if (!activeFlower.visible) closeTip()
      else if (tipEl) {
        activeFlower.getWorldPosition(proj)
        proj.project(camera)
        const r = el.getBoundingClientRect()
        tipEl.style.left = (proj.x * 0.5 + 0.5) * r.width + 'px'
        tipEl.style.top = (-proj.y * 0.5 + 0.5) * r.height + 'px'
      }
    }

    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(frame)

  return {
    syncFlowers: syncFlowers,
    focusFlower: focusFlower,
    dispose: function () {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown2)
      el.removeEventListener('pointermove', onMove2)
      el.removeEventListener('pointerup', onUp2)
      el.removeEventListener('pointercancel', onUp2)
      grassGeo.dispose()
      grassMat.dispose()
      coreGeo.dispose()
      coreMat.dispose()
      fieldQuadGeo.dispose()
      fieldMat.dispose()
      fieldA.dispose()
      fieldB.dispose()
      entries.forEach(function (entry) {
        entry.flower.geometry.dispose()
      })
      flowerMat.dispose()
      pickGeo.dispose()
      pickMat.dispose()
      renderer.dispose()
      if (el.parentNode) el.parentNode.removeChild(el)
    },
  }
}

export type GrassGlobeProps = {
  flowers: GrassGlobeFlower[]
  onFlowerTap?: (flower: GrassGlobeFlower) => void
  options?: Partial<GrassGlobeOptions>
  hint?: string
  style?: CSSProperties
  handleRef?: Ref<GrassGlobeHandle | null>
}

export default function GrassGlobe({
  flowers,
  onFlowerTap,
  options,
  hint = 'drag to spin · tap a flower',
  style,
  handleRef,
}: GrassGlobeProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const tipHeadRef = useRef<HTMLDivElement>(null)
  const tipTimeRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GrassGlobeHandle | null>(null)

  const tapRef = useRef(onFlowerTap)
  tapRef.current = onFlowerTap

  const flowersRef = useRef(flowers)
  flowersRef.current = flowers
  const optionsRef = useRef(options)
  optionsRef.current = options

  // A stable proxy: the scene behind it is torn down and rebuilt on view
  // changes, so callers must not hold the instance itself.
  useImperativeHandle(
    handleRef,
    () => ({
      dispose: () => globeRef.current?.dispose(),
      syncFlowers: (next: GrassGlobeFlower[]) =>
        globeRef.current?.syncFlowers(next),
      focusFlower: (id: string) => globeRef.current?.focusFlower(id),
    }),
    [],
  )

  // Only the view options force a rebuild; flowers are synced in place so
  // planting a memory never resets the spin, zoom or grass.
  const signature = useMemo(
    () => JSON.stringify(options ?? null),
    [options],
  )

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const globe = createGrassGlobe(stage, {
      ...optionsRef.current,
      flowers: flowersRef.current,
      onFlowerTap: (flower) => tapRef.current?.(flower),
      tipEl: tipRef.current,
      tipHeadEl: tipHeadRef.current,
      tipTimeEl: tipTimeRef.current,
      hintEl: hintRef.current,
    })
    globeRef.current = globe

    return () => {
      globeRef.current = null
      globe.dispose()
    }
  }, [signature])

  useEffect(() => {
    globeRef.current?.syncFlowers(flowers)
  }, [flowers])

  return (
    <div
      ref={stageRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background:
          'radial-gradient(120% 90% at 50% 12%, #f4f2fb 0%, #eceaf6 42%, #e6e4f2 100%)',
        touchAction: 'none',
        ...style,
      }}
    >
      <div ref={tipRef} className="gg-tip">
        <div ref={tipHeadRef} className="gg-tip-h" />
        <div ref={tipTimeRef} className="gg-tip-t" />
      </div>
      {hint ? (
        <div ref={hintRef} className="gg-hint">
          {hint}
        </div>
      ) : null}
    </div>
  )
}
