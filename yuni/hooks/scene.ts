// 유니의 무대를 픽셀로 칠한 뒤, 터미널용 반쪽 블록 칸(▀)이나 Desktop용 SVG로 바꾼다.
import { ALICORN, BABY, BRANCHES, COATS, CRACK, EGG, FRIEND_EGG, FRIEND_FOAL, HIDE, LYING, YOUTH } from './sprites'
import type { Branch, Sprite } from './sprites'

// 호스트 환경에는 있지만 es2023 lib에는 아직 없는 메서드
declare global {
  interface Uint8Array {
    toBase64(): string
  }
}

export const PET_W = 16
export const PET_H = 16

export type Eyes = 'open' | 'closed' | 'happy' | 'sleepy'

export type SceneInput = {
  columns: number
  rows: number
  tick: number
  hour: number
  petX: number
  bob: number
  facingLeft: boolean
  stage: number
  cracked: boolean
  hiding: boolean
  lying: boolean
  branch: Branch
  coat: number
  eyes: Eyes
  tear: boolean
  alert: boolean
  ring: number
  rainbow: number
  hearts: { x: number; y: number }[]
  sparkles: { x: number; y: number; color: number }[]
  friends: { x: number; y: number; foal: boolean }[]
  zzz: boolean
}

type Glyph = { x: number; y: number; ch: string; color: number }
export type Painted = { px: Uint32Array; W: number; PH: number; glyphs: Glyph[] }

const OUTLINE = 0x2b2238
const HEART = 0xff6b8a
const TEAR = 0x7ec8ff
const DEFAULT = 0x01000000
export const RAINBOW = [0xff6b6b, 0xffa94d, 0xffe066, 0x8ce99a, 0x74c0fc, 0xb197fc]

const lerp = (a: number, b: number, k: number) => {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

export const isNight = (hour: number) => hour >= 19 || hour < 5

function sky(hour: number): [number, number] {
  if (hour >= 5 && hour < 7) return [0xffb5a7, 0xffe5d9]
  if (hour >= 7 && hour < 17) return [0x9fd3f0, 0xf3e8ff]
  if (hour >= 17 && hour < 19) return [0x6d597a, 0xffb4a2]
  return [0x141b38, 0x2b3a67]
}

const CLOUD = ['..xxx...', '.xxxxxx.', 'xxxxxxxx']
const HEART_SHAPE = ['.x.x.', 'xxxxx', '.xxx.', '..x..']

export const groundTop = (rows: number) => rows * 2 - 3
export const petTop = (rows: number) => groundTop(rows) - PET_H

export function spriteFor(s: Pick<SceneInput, 'stage' | 'hiding' | 'lying'>): Sprite {
  if (s.hiding) return HIDE
  if (s.stage === 0) return EGG
  if (s.lying) return LYING
  return [EGG, BABY, YOUTH, ALICORN][s.stage] ?? ALICORN
}

export function paint(s: SceneInput): Painted {
  const W = s.columns
  const PH = s.rows * 2
  const px = new Uint32Array(W * PH)
  const glyphs: Glyph[] = []
  const put = (x: number, y: number, c: number) => {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < W && y >= 0 && y < PH) px[y * W + x] = c
  }
  const stamp = (rows: readonly string[], x0: number, y0: number, colors: Record<string, number>, flip = false) =>
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const c = colors[ch]
        if (c !== undefined) put(x0 + (flip ? row.length - 1 - x : x), y0 + y, c)
      }),
    )

  const night = isNight(s.hour)
  const [top, bottom] = sky(s.hour)
  const gTop = groundTop(s.rows)
  for (let y = 0; y < gTop; y++) {
    const c = lerp(top, bottom, y / Math.max(1, gTop - 1))
    for (let x = 0; x < W; x++) px[y * W + x] = c
  }

  if (night) {
    for (let i = 0; i < Math.floor(W / 3); i++) {
      const twinkle = ((s.tick >> 3) + i) % 7 === 0
      put((i * 37 + 11) % W, (i * 17 + 3) % Math.max(1, gTop - 6), twinkle ? 0x8890b8 : 0xfff8d6)
    }
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if (dx * dx + dy * dy <= 9 && (dx - 1.6) ** 2 + (dy + 1) ** 2 > 6) put(W - 6 + dx, 4 + dy, 0xfdf3c4)
  } else {
    const cloud = s.hour >= 17 ? 0xffd6e0 : 0xffffff
    for (const [offset, y] of [
      [0, 0],
      [W * 0.55, 2],
    ] as const)
      stamp(CLOUD, ((s.tick * 0.04 + offset) % (W + 10)) - 9, y, { x: cloud })
  }

  if (s.rainbow > 0) {
    // 레벨이 오르거나 진화하면 하늘에 무지개가 뜬다
    const cx = W / 2
    const cy = gTop + 4
    for (let y = 0; y < gTop; y++)
      for (let x = 0; x < W; x++) {
        const band = Math.floor((W * 0.55 - Math.hypot((x - cx) / 1.4, (y - cy) * 1.1)) / 1.2)
        const c = RAINBOW[band]
        if (c !== undefined && band >= 0) put(x, y, s.rainbow >= 1 ? c : lerp(px[y * W + x] ?? 0, c, s.rainbow))
      }
  }

  // 멀리 보이는 언덕
  for (let x = 0; x < W; x++) {
    const h = Math.round(3 + 2 * Math.sin(x / 7) + Math.sin(x / 3.1))
    for (let y = gTop - h; y < gTop; y++) put(x, y, night ? 0x2c4a45 : 0xbfe3b4)
  }

  const grass = night ? [0x3f6b55, 0x2f5444, 0x23423a] : [0x9ad89a, 0x74c27c, 0x5aa66a]
  for (let y = gTop; y < PH; y++) for (let x = 0; x < W; x++) px[y * W + x] = grass[Math.min(2, y - gTop)] ?? 0
  for (let x = 3; x < W; x += 7) put(x, gTop - 1, RAINBOW[(x >> 3) % RAINBOW.length] ?? 0xffffff)

  const look = BRANCHES[s.branch]
  const coat = COATS[s.coat] ?? COATS[0]!
  const darkCoat = coat.body < 0x808080
  const pTop = petTop(s.rows) + s.bob
  const cx = s.petX + PET_W / 2 - 0.5
  const cy = petTop(s.rows) + PET_H / 2

  if (s.ring > 0) {
    const color = night ? 0xa5b4fc : 0xffffff
    for (let y = 0; y < gTop; y++)
      for (let x = 0; x < W; x++) if (Math.abs(Math.hypot((x - cx) / 1.6, y - cy) - s.ring) < 0.5) put(x, y, color)
  }

  const colors: Record<string, number> = {
    o: OUTLINE,
    f: coat.body,
    F: coat.shade,
    m: look.mane,
    M: look.mane2,
    h: s.alert && (s.tick >> 1) % 2 ? 0xd7263d : look.horn,
    k: darkCoat ? 0xfff6cf : 0x2a2238,
    p: 0xffb3c6,
    u: 0xc9b9d6,
    W: 0xe6f6ff,
    e: 0xfff3dc,
    s: look.mane,
    w: 0xfff6cf,
  }

  for (const f of s.friends) stamp(f.foal ? FRIEND_FOAL : FRIEND_EGG, f.x, f.y, colors)

  const sprite = spriteFor(s)
  const grid = sprite.rows.map(r => [...r])
  const set = (x: number, y: number, ch: string) => {
    const row = grid[y]
    if (row && x >= 0 && x < row.length) row[x] = ch
  }
  const e = sprite.eye
  if (e && !s.hiding) {
    const last = e.y + e.h - 1
    for (let y = e.y; y <= last; y++) set(e.x, y, 'f')
    if (s.eyes === 'open') for (let y = e.y; y <= last; y++) set(e.x, y, 'k')
    else if (s.eyes === 'happy') set(e.x, e.y, 'k')
    else if (s.eyes === 'sleepy') {
      set(e.x, last, 'k')
      if (e.h > 1) set(e.x, e.y, 'o')
    } else set(e.x, last, 'k')
  }
  let x0 = s.petX
  if (s.stage === 0 && !s.hiding && s.eyes === 'happy') x0 += Math.round(Math.sin(s.tick * 0.8))
  stamp(
    grid.map(r => r.join('')),
    x0,
    pTop,
    colors,
    s.facingLeft,
  )
  if (s.stage === 0 && s.cracked && !s.hiding) for (const [x, y] of CRACK) put(x0 + x, pTop + y, OUTLINE)
  if (s.tear && e) {
    const tx = x0 + (s.facingLeft ? PET_W - 1 - e.x : e.x)
    put(tx, pTop + e.y + e.h, TEAR)
    put(tx, pTop + e.y + e.h + 1, TEAR)
  }

  for (const h of s.hearts) stamp(HEART_SHAPE, h.x, h.y, { x: HEART })
  for (const p of s.sparkles) put(p.x, p.y, p.color)

  const hornX = x0 + (s.facingLeft ? PET_W - 1 - sprite.horn[0] : sprite.horn[0])
  const glyphRow = Math.floor((pTop + sprite.horn[1] - 1) / 2)
  if (s.alert) glyphs.push({ x: hornX, y: Math.max(0, glyphRow - 1), ch: '!', color: 0xd7263d })
  if (s.zzz) {
    const phase = (s.tick >> 3) % 3
    for (let k = 0; k <= phase; k++)
      glyphs.push({
        x: Math.round(hornX + (s.facingLeft ? -2 - k : 2 + k)),
        y: glyphRow - k,
        ch: k === 2 ? 'Z' : 'z',
        color: night ? 0xe0e7ff : 0x4a4e69,
      })
  }
  return { px, W, PH, glyphs: glyphs.filter(g => g.x >= 0 && g.x < W && g.y >= 0 && g.y < s.rows) }
}

/** 뿔 끝의 화면 좌표: 반짝이가 여기서 터진다 */
export function hornTip(s: Pick<SceneInput, 'stage' | 'hiding' | 'lying' | 'petX' | 'facingLeft' | 'rows'>) {
  const sp = spriteFor(s)
  return { x: s.petX + (s.facingLeft ? PET_W - 1 - sp.horn[0] : sp.horn[0]), y: petTop(s.rows) + sp.horn[1] }
}

export function toCells({ px, W, PH, glyphs }: Painted): string {
  const rows = PH / 2
  const words = new Uint32Array(W * rows * 3)
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < W; cx++) {
      const i = (cy * W + cx) * 3
      words[i] = 0x2580
      words[i + 1] = px[cy * 2 * W + cx] || DEFAULT
      words[i + 2] = px[(cy * 2 + 1) * W + cx] || DEFAULT
    }
  for (const g of glyphs) {
    const i = (g.y * W + g.x) * 3
    words[i] = g.ch.charCodeAt(0)
    words[i + 1] = g.color
    words[i + 2] = px[g.y * 2 * W + g.x] || DEFAULT
  }
  return new Uint8Array(words.buffer).toBase64()
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0')

// Desktop 앱용: 같은 픽셀을 가로로 이어 붙인 사각형으로 그린다
export function toSvg({ px, W, PH, glyphs }: Painted): string {
  const parts: string[] = []
  for (let y = 0; y < PH; y++) {
    let x = 0
    while (x < W) {
      const c = px[y * W + x] ?? 0
      let run = 1
      while (x + run < W && px[y * W + x + run] === c) run++
      parts.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${hex(c)}"/>`)
      x += run
    }
  }
  for (const g of glyphs)
    parts.push(
      `<text x="${g.x + 0.5}" y="${g.y * 2 + 1.7}" font-size="2" font-family="monospace" text-anchor="middle" fill="${hex(g.color)}">${g.ch}</text>`,
    )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${PH}" shape-rendering="crispEdges">${parts.join('')}</svg>`
}
