import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { DayLog, Pet, View } from '../types'
import { PET_W, RAINBOW, hornTip, paint, petTop, toCells, toSvg } from './scene'
import type { Eyes } from './scene'
import { BRANCHES, COATS, CRACK_AT, STAGES, stageOf } from './sprites'
import type { Branch } from './sprites'

const PANE = 'yuni'
const ROWS = 11
const TICK_MS = 100
const SLEEP_AFTER_MS = 5 * 60_000

const NEW_DAY = (day: string, now: number): DayLog => ({ day, turns: 0, tools: 0, files: [], breaks: 0, guards: 0, firstAt: now })
const NEW_PET: Pet = {
  name: '유니',
  xp: 0,
  happy: 70,
  full: 70,
  turns: 0,
  branch: '알',
  coat: 0,
  counts: { edit: 0, search: 0, bash: 0 },
  guards: 0,
  breaks: 0,
  streak: 1,
  lastDay: '',
  breakMin: 50,
  band: true,
  today: NEW_DAY('', 0),
}
const NEW_VIEW: View = {
  line: '함께 있을게요',
  bubble: '',
  mode: 'normal',
  breath: '',
  startedAt: 0,
  nextBreakAt: 0,
  friends: [],
  context: null,
  fiveHour: null,
  week: null,
  cost: null,
}

const pet = atom({ plugin: 'yuni', key: 'pet' } as const, NEW_PET)
const view = atom({ plugin: 'yuni', key: 'view' } as const, NEW_VIEW)

// ── 한글 문구 ─────────────────────────────────────────────

// 지금 하는 일을 한 줄로: 정보 줄과 패널에 쓴다
const TOOL_KO: Record<string, string> = {
  Bash: '명령어를 실행하고 있어요 ⚙️',
  PowerShell: '명령어를 실행하고 있어요 ⚙️',
  Read: '파일을 읽고 있어요 📖',
  Edit: '코드를 고치고 있어요 ✏️',
  MultiEdit: '코드를 고치고 있어요 ✏️',
  Write: '파일을 쓰고 있어요 ✏️',
  NotebookEdit: '노트북을 고치고 있어요 ✏️',
  Grep: '내용을 찾아보고 있어요 🔍',
  Glob: '파일을 찾아보고 있어요 🔍',
  WebSearch: '인터넷에서 찾아보고 있어요 🌐',
  WebFetch: '웹 페이지를 읽고 있어요 🌐',
  Skill: '스킬을 꺼내 쓰고 있어요 🧰',
  Agent: '도우미에게 일을 맡겼어요 🤝',
  TodoWrite: '할 일을 정리하고 있어요 📝',
}

const CHEERS = [
  '수고했어요! 오늘도 반짝반짝 ✨',
  '하나 끝냈어요! 물 한 모금 어때요? 💧',
  '잘하고 있어요. 천천히 가요 🌿',
  '유니가 뿔로 박수 쳐요 🦄',
  '끝! 어깨 한 번 쭉 펴볼까요?',
]
const OOPS = ['앗, 실패했어요. 괜찮아요, 다시 하면 돼요 🍀', '에러도 배우는 과정이에요', '토닥토닥… 금방 고칠 거예요']
const STRETCH = [
  '목을 천천히 좌우로 돌려요 🙆',
  '어깨를 귀까지 올렸다가 툭 떨어뜨려요',
  '먼 곳을 20초 바라봐요 (눈 휴식) 👀',
  '일어나서 물 한 잔 마셔요 💧',
  '손목을 돌리고 손가락을 쫙 펴요 ✋',
  '허리를 펴고 숨을 크게 쉬어요 🌬️',
]
const PETTED = ['히힝, 좋아요 💕', '갈기 쓰다듬어 줘서 고마워요', '더 쓰다듬어 줘요!', '기분 최고예요 🌸']
const FED = ['냠냠! 각설탕 맛있어요 🍬', '당근 최고예요 🥕', '오물오물… 🍎']
const BREATH = ['들이마셔요', '잠깐 멈춰요', '내쉬어요', '잠깐 멈춰요']

// 되돌리기 어려운 명령어: 뿔이 빨갛게 빛나고 한 번 더 확인을 받는다
const DANGER: [RegExp, string][] = [
  [/\brm\s+-[a-zA-Z]*(rf|fr)\b|\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f/, '파일을 통째로 지우는 rm -rf'],
  [/\bgit\s+push\b[^\n]*(--force\b|--force-with-lease|\s-f\b)/, '원격 기록을 덮어쓰는 강제 push'],
  [/\bgit\s+reset\s+--hard\b/, '작업한 내용을 버리는 reset --hard'],
  [/\bgit\s+clean\s+-[a-zA-Z]*f/, '추적 안 되는 파일을 지우는 git clean'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, '수정 사항을 되돌리는 checkout/restore .'],
  [/\bgit\s+branch\s+-D\b/, '브랜치를 강제로 지우는 branch -D'],
  [/\bdrop\s+(table|database|schema)\b/i, '데이터베이스를 지우는 DROP'],
  [/\btruncate\s+table\b/i, '테이블을 비우는 TRUNCATE'],
  [/\bRemove-Item\b[^\n]*-Recurse/i, '폴더를 통째로 지우는 Remove-Item -Recurse'],
  [/\b(mkfs|format\s+[a-z]:)/i, '디스크를 포맷하는 명령어'],
  [/--no-verify\b/, '검사를 건너뛰는 --no-verify'],
]

const RANKS: [number, string][] = [
  [0, '견습 지킴이'],
  [3, '꼬마 수호자'],
  [10, '무지개 기사'],
  [30, '별빛 수호대장'],
  [100, '전설의 수호자'],
]

// ── 작은 도우미 ─────────────────────────────────────────────

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)] ?? ''
const clamp = (n: number) => Math.max(0, Math.min(100, n))
export const levelOf = (xp: number) => 1 + Math.floor(Math.sqrt(xp / 20))
export const xpFor = (level: number) => (level - 1) ** 2 * 20
const dayOf = (ms: number) => new Date(ms).toLocaleDateString('sv')
const rankOf = (guards: number) => RANKS.filter(([n]) => guards >= n).pop()?.[1] ?? '견습 지킴이'
const argOf = (input: unknown, key: string) => {
  const v = key && input && typeof input === 'object' ? (input as Record<string, unknown>)[key] : undefined
  return typeof v === 'string' ? v : ''
}
const short = (s: string, n = 60) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? one.slice(0, n - 1) + '…' : one
}
const tail = (path: string) => path.split(/[\\/]/).slice(-2).join('/')
const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export const dangerOf = (command: string) => DANGER.find(([re]) => re.test(command))?.[1]

export function branchFrom(counts: Pet['counts']): Branch {
  const { edit, search, bash } = counts
  if (edit >= search && edit >= bash) return '불꽃'
  if (bash >= search) return '강철'
  return '바람'
}

function withToday(p: Pet, now: number): Pet {
  const day = dayOf(now)
  return p.today.day === day ? p : { ...p, today: NEW_DAY(day, now) }
}

// ── 애니메이션: 리로드되면 새로 시작해도 괜찮은 값들 ──────────────

type Walker = { x: number; target: number; y: number; foal: boolean }
const anim = {
  columns: 0,
  tick: 0,
  x: 4,
  target: 4,
  facingLeft: false,
  lastActive: Date.now(),
  inflight: 0,
  mood: 'idle' as 'idle' | 'happy' | 'sad' | 'eat',
  moodUntil: 0,
  alertUntil: 0,
  rainbowUntil: 0,
  hearts: [] as { x: number; y: number }[],
  sparkles: [] as { x: number; y: number; vx: number; vy: number; color: number; life: number }[],
  friends: new Map<string, Walker>(),
  breatheFrom: -1,
  hour: new Date().getHours(),
}
const timers: Timer[] = []
let lastBreakAt = Date.now()
let snoozeUntil = 0
let lastNightNag = 0
let warnedContext = false

const asleep = () => anim.inflight === 0 && anim.breatheFrom < 0 && Date.now() - anim.lastActive > SLEEP_AFTER_MS

function wake() {
  anim.lastActive = Date.now()
}

function feel(mood: typeof anim.mood, ms: number) {
  anim.mood = mood
  anim.moodUntil = anim.tick + ms / TICK_MS
}

function sparkle(p: Pet, v: View) {
  const tip = hornTip({ ...looks(p, v), petX: anim.x, facingLeft: anim.facingLeft, rows: ROWS })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    anim.sparkles.push({
      x: tip.x,
      y: tip.y,
      vx: Math.cos(a) * 0.7,
      vy: Math.sin(a) * 0.5 - 0.2,
      color: RAINBOW[i % RAINBOW.length] ?? 0xffffff,
      life: 14,
    })
  }
}

function looks(p: Pet, v: View) {
  return {
    stage: stageOf(p.turns),
    hiding: (v.fiveHour ?? 0) >= 95 || (v.week ?? 0) >= 95,
    lying: (v.context ?? 0) >= 85,
  }
}

function frame(p: Pet, v: View) {
  const t = anim.tick
  const mood = t < anim.moodUntil ? anim.mood : 'idle'
  const walking = Math.abs(anim.x - anim.target) >= 1
  const tired = (v.fiveHour ?? 0) >= 80
  const sleeping = asleep()
  const eyes: Eyes = sleeping
    ? 'closed'
    : mood === 'happy' || mood === 'eat'
      ? 'happy'
      : tired
        ? 'sleepy'
        : t % 45 < 2
          ? 'closed'
          : 'open'
  const bob = sleeping
    ? 0
    : mood === 'happy'
      ? -Math.round(Math.abs(Math.sin(t * 0.4)) * 3)
      : walking
        ? -((t >> 1) % 2)
        : -((t >> 3) % 2)
  let ring = 0
  if (anim.breatheFrom >= 0) {
    // 4초 들숨, 4초 멈춤, 4초 날숨, 4초 멈춤
    const k = (((t - anim.breatheFrom) * TICK_MS) / 1000) % 16
    ring = 9 + (k < 4 ? k / 4 : k < 8 ? 1 : k < 12 ? 1 - (k - 8) / 4 : 0) * 5
  }
  const rainbowLeft = anim.rainbowUntil - t
  return paint({
    columns: anim.columns,
    rows: ROWS,
    tick: t,
    hour: anim.hour,
    petX: anim.x,
    bob,
    facingLeft: anim.facingLeft,
    ...looks(p, v),
    cracked: p.turns >= CRACK_AT,
    branch: p.branch,
    coat: p.coat,
    eyes,
    tear: mood === 'sad',
    alert: t < anim.alertUntil,
    ring,
    rainbow: rainbowLeft > 0 ? Math.min(1, rainbowLeft / 20) : 0,
    hearts: anim.hearts,
    sparkles: anim.sparkles,
    friends: [...anim.friends.values()].map(f => ({ x: f.x, y: f.y, foal: f.foal })),
    zzz: sleeping,
  })
}

function step(v: View) {
  anim.tick += 1
  const maxX = Math.max(0, anim.columns - PET_W)
  const still = asleep() || (v.context ?? 0) >= 85 || (v.fiveHour ?? 0) >= 95 || (v.week ?? 0) >= 95
  if (anim.breatheFrom >= 0) anim.target = Math.round(maxX / 2)
  else if (Math.abs(anim.x - anim.target) < 1 && Math.random() < 0.02) anim.target = Math.round(Math.random() * maxX)
  if (!still && Math.abs(anim.x - anim.target) >= 1) {
    anim.facingLeft = anim.target < anim.x
    anim.x += (anim.facingLeft ? -1 : 1) * (anim.inflight > 0 ? 0.9 : 0.4)
  }
  anim.x = Math.max(0, Math.min(maxX, anim.x))
  anim.hearts = anim.hearts.map(h => ({ x: h.x + (Math.random() - 0.5), y: h.y - 0.25 })).filter(h => h.y > -4)
  anim.sparkles = anim.sparkles
    .map(s => ({ ...s, x: s.x + s.vx, y: s.y + s.vy, vy: s.vy + 0.03, life: s.life - 1 }))
    .filter(s => s.life > 0)

  // 순찰대: 새 친구는 왼쪽에서 알로 굴러오고, 일이 끝난 친구는 아기 유니콘이 되어 날아간다
  const groundY = ROWS * 2 - 3 - 7
  const live = new Set(v.friends.map(f => f.id))
  for (const f of v.friends)
    if (!anim.friends.has(f.id))
      anim.friends.set(f.id, { x: -6, target: 2 + Math.random() * Math.max(1, anim.columns - 10), y: groundY, foal: false })
  for (const [id, f] of anim.friends) {
    if (!live.has(id)) f.foal = true
    if (f.foal) {
      f.y -= 0.35
      f.x += 0.3
      if (f.y < -10) anim.friends.delete(id)
    } else if (Math.abs(f.x - f.target) >= 1) f.x += f.target > f.x ? 0.6 : -0.6
    else if (Math.random() < 0.01) f.target = 2 + Math.random() * Math.max(1, anim.columns - 10)
  }
}

// ── 상태 바꾸기 ─────────────────────────────────────────────

async function changePet($: EngineInterface, fn: (p: Pet) => Pet) {
  const before = await read($, pet)
  const now = await $.clock.now()
  const next = await update($, pet, p => fn(withToday(p, now)))
  const lvBefore = levelOf(before.xp)
  const lvAfter = levelOf(next.xp)
  const stBefore = stageOf(before.turns)
  const stAfter = stageOf(next.turns)

  if (before.turns < CRACK_AT && next.turns >= CRACK_AT) {
    feel('happy', 3000)
    $.ui.toast(`🥚 ${next.name}의 알에 금이 갔어요! 답변 ${STAGES[1].turns - next.turns}번 더 하면 부화해요`)
  }
  if (stAfter > stBefore) {
    anim.rainbowUntil = anim.tick + 80
    feel('happy', 4000)
    if (stBefore === 0) {
      const branch = branchFrom(next.counts)
      const coat = Math.floor(Math.random() * COATS.length)
      const hatched = await update($, pet, p => ({ ...p, branch, coat }))
      await $.store.set('pet', hatched)
      $.ui.toast(`🦄 부화했어요! ${branch} 유니콘이에요 (${COATS[coat]?.name} 털). ${BRANCHES[branch].about}`)
      await say($, `안녕하세요! 저는 ${branch} 유니콘 ${next.name}예요 🌈`)
      return
    }
    $.ui.toast(`🌈 ${next.name}가 ${STAGES[stAfter]?.name}(으)로 진화했어요!`)
    await say($, `${STAGES[stAfter]?.name}이 됐어요! 고마워요 ✨`)
  } else if (lvAfter > lvBefore) {
    anim.rainbowUntil = anim.tick + 40
    $.ui.toast(`⭐ ${next.name} 레벨 ${lvAfter}!`)
  }
  await $.store.set('pet', next)
}

async function say($: EngineInterface, bubble: string) {
  await update($, view, v => ({ ...v, bubble }))
}

async function takeBreak($: EngineInterface) {
  const now = await $.clock.now()
  lastBreakAt = now
  snoozeUntil = 0
  wake()
  feel('happy', 2500)
  const p = await read($, pet)
  await update($, view, v => ({
    ...v,
    mode: 'normal' as const,
    nextBreakAt: now + p.breakMin * 60_000,
    bubble: '잘 쉬었어요! 다시 힘내요 💪',
  }))
  await changePet($, x => ({
    ...x,
    happy: clamp(x.happy + 15),
    xp: x.xp + 10,
    breaks: x.breaks + 1,
    today: { ...x.today, breaks: x.today.breaks + 1 },
  }))
}

async function snooze($: EngineInterface) {
  const now = await $.clock.now()
  snoozeUntil = now + 10 * 60_000
  await update($, view, v => ({ ...v, mode: 'normal' as const, nextBreakAt: snoozeUntil, bubble: '알겠어요, 10분 뒤에 다시 알려줄게요 ⏰' }))
}

async function startBreathing($: EngineInterface) {
  anim.breatheFrom = anim.tick
  wake()
  await update($, view, v => ({
    ...v,
    mode: 'breathe' as const,
    breath: '들이마셔요 · 4   (1/4)',
    bubble: '유니랑 같이 숨 쉬어요. 원이 커지면 들이마셔요',
  }))
}

async function stopBreathing($: EngineInterface) {
  anim.breatheFrom = -1
  await update($, view, v => ({ ...v, mode: 'normal' as const, breath: '', bubble: '언제든 다시 불러줘요' }))
}

async function breathTick($: EngineInterface) {
  if (anim.breatheFrom < 0) return
  const sec = Math.floor(((anim.tick - anim.breatheFrom) * TICK_MS) / 1000)
  if (sec >= 64) {
    anim.breatheFrom = -1
    feel('happy', 2500)
    await update($, view, v => ({ ...v, mode: 'normal' as const, breath: '', bubble: '숨쉬기 끝! 마음이 말랑말랑해졌어요 ☁️' }))
    await changePet($, p => ({ ...p, happy: clamp(p.happy + 10), xp: p.xp + 8 }))
    return
  }
  const k = sec % 16
  const line = `${BREATH[Math.floor(k / 4)]} · ${4 - (k % 4)}   (${Math.floor(sec / 16) + 1}/4)`
  await update($, view, v => ({ ...v, breath: line }))
}

async function petIt($: EngineInterface) {
  wake()
  feel('happy', 2000)
  const top = petTop(ROWS) - 2
  anim.hearts.push({ x: anim.x + 3, y: top }, { x: anim.x + 9, y: top + 1 })
  await say($, pick(PETTED))
  await changePet($, p => ({ ...p, happy: clamp(p.happy + 5), xp: p.xp + 1 }))
}

async function feed($: EngineInterface) {
  wake()
  if ((await read($, pet)).full >= 95) return say($, '이미 배불러요! 나중에 줘요 🙅')
  feel('eat', 2000)
  await say($, pick(FED))
  await changePet($, p => ({ ...p, full: clamp(p.full + 25), xp: p.xp + 1 }))
}

async function showToday($: EngineInterface) {
  await update($, view, v => ({ ...v, mode: 'today' as const }))
}

async function closeToday($: EngineInterface) {
  await update($, view, v => ({ ...v, mode: 'normal' as const }))
}

async function refreshUsage($: EngineInterface) {
  const u = await $.session.usage()
  const context = u.context.percent ?? null
  const fiveHour = u.rateLimits.find(r => r.kind === 'five_hour')?.percentUsed ?? null
  const week = u.rateLimits.find(r => r.kind === 'seven_day')?.percentUsed ?? null
  const cost = u.cost?.usd ?? null
  const v = await read($, view)
  if (v.context === context && v.fiveHour === fiveHour && v.week === week && v.cost === cost) return
  await update($, view, x => ({ ...x, context, fiveHour, week, cost }))
  if ((context ?? 0) >= 80 && !warnedContext) {
    warnedContext = true
    $.ui.toast(`🧠 컨텍스트 ${context}%: 유니가 배불러해요. /compact 하면 가벼워져요`)
  }
  if ((context ?? 0) < 60) warnedContext = false
}

async function everyHalfMinute($: EngineInterface) {
  const t = await $.clock.now()
  anim.hour = new Date(t).getHours()
  await changePet($, p => ({ ...p, full: clamp(p.full - 0.2), happy: clamp(p.happy - 0.1) }))
  const v = await read($, view)
  const p = await read($, pet)
  if (v.mode === 'normal' && t - lastBreakAt >= p.breakMin * 60_000 && t >= snoozeUntil) {
    const tip = pick(STRETCH)
    await update($, view, x => ({ ...x, mode: 'break' as const, bubble: `${p.breakMin}분 일했어요. 잠깐 쉬어요! ${tip}` }))
    $.ui.toast(`🦄 ${p.name}: ${p.breakMin}분 지났어요. ${tip}`)
  }
  if (anim.hour < 5 && t - lastNightNag > 60 * 60_000) {
    lastNightNag = t
    await say($, `새벽 ${anim.hour}시예요. ${p.name}는 졸려요… 이제 자는 건 어때요? 🌙`)
  }
}

async function paintPane($: EngineInterface) {
  const v = await read($, view)
  step(v)
  if (anim.columns === 0) return
  const p = await read($, pet)
  void $.ui.blit({ requestId: PANE, key: 'scene', cells: toCells(frame(p, v)) })
}

// ── 훅 ─────────────────────────────────────────────

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const now = await $.clock.now()
    anim.lastActive = now
    anim.hour = new Date(now).getHours()
    lastBreakAt = now

    const saved = { ...NEW_PET, ...((await $.store.get('pet')) as Partial<Pet> | undefined) }
    const today = dayOf(now)
    const streak =
      saved.lastDay === today ? saved.streak : saved.lastDay === dayOf(now - 86_400_000) ? saved.streak + 1 : 1
    const loaded = await update($, pet, () => withToday({ ...saved, streak, lastDay: today }, now))
    await $.store.set('pet', loaded)

    if ((await read($, view)).startedAt === 0) {
      const h = anim.hour
      const greet =
        h < 5 ? '새벽이에요… 너무 무리하지 마요 🌙' : h < 12 ? '좋은 아침이에요! ☀️' : h < 18 ? '좋은 오후예요! 🌤️' : '좋은 저녁이에요 🌆'
      await update($, view, () => ({
        ...NEW_VIEW,
        startedAt: now,
        nextBreakAt: now + loaded.breakMin * 60_000,
        bubble: loaded.streak > 1 ? `${greet} ${loaded.streak}일 연속 만났어요!` : greet,
      }))
    }

    await $.command.register({
      name: 'yuni',
      description: '유니 패널 · 숨 / 쉬기 / 오늘 / 이름 <이름> / 알림 <분> / 정보줄 켜기·끄기',
      argumentHint: '[숨|쉬기|오늘|이름|알림|정보줄]',
      immediate: true,
    })
    void $.ui.open({ id: PANE, title: '유니' })

    timers.push(
      $.clock.every(TICK_MS, () => void paintPane($)),
      $.clock.every(1000, () => void breathTick($)),
      $.clock.every(10_000, () => void refreshUsage($)),
      $.clock.every(30_000, () => void everyHalfMinute($)),
    )
    void refreshUsage($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    wake()
    anim.inflight += 1
    const tool = String(e.tool)
    const ko = TOOL_KO[tool]
    const args = e as unknown as Record<string, unknown>
    const kind = /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)
      ? 'edit'
      : /^(Read|Grep|Glob|WebSearch|WebFetch)$/.test(tool)
        ? 'search'
        : /^(Bash|PowerShell)$/.test(tool)
          ? 'bash'
          : null
    const file = kind === 'edit' ? argOf(args, 'file_path') || argOf(args, 'notebook_path') : ''
    const friendId = tool === 'Agent' ? (e.tool_use_id ?? `agent-${anim.tick}`) : ''

    await update($, view, v => ({
      ...v,
      line: ko ?? (tool.startsWith('mcp__') ? '외부 도구를 쓰고 있어요 🔌' : `${tool} 쓰는 중`),
      friends: friendId
        ? [...v.friends, { id: friendId, label: short(argOf(args, 'description') || '도우미', 24), since: Date.now() }]
        : v.friends,
    }))
    try {
      const ran = await next(e)
      if (ran.isError) {
        feel('sad', 4000)
        await say($, pick(OOPS))
      }
      return ran
    } finally {
      anim.inflight = Math.max(0, anim.inflight - 1)
      if (friendId) await update($, view, v => ({ ...v, friends: v.friends.filter(f => f.id !== friendId) }))
      await changePet($, p => ({
        ...p,
        xp: p.xp + 1,
        counts: kind ? { ...p.counts, [kind]: p.counts[kind] + 1 } : p.counts,
        today: {
          ...p.today,
          tools: p.today.tools + 1,
          files: file && !p.today.files.includes(file) ? [...p.today.files, file].slice(-200) : p.today.files,
        },
      }))
    }
  })

  // 위험한 명령어: 이미 허락된 상태여도 한 번 더 묻게 만든다 (더 엄격하게만 바꾼다)
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (e.tool !== 'Bash' && e.tool !== 'PowerShell') return verdict
    const what = dangerOf(argOf(e.input, 'command'))
    if (!what) return verdict
    if (e.tool_use_id) {
      anim.alertUntil = anim.tick + 50
      wake()
      await say($, `🚨 잠깐요! ${what}이에요. 정말 괜찮은지 확인해 주세요`)
      await changePet($, p => ({ ...p, guards: p.guards + 1, xp: p.xp + 3, today: { ...p.today, guards: p.today.guards + 1 } }))
    }
    if (verdict.decision !== 'allow') return verdict
    return { ...verdict, decision: 'ask' as const, reason: `🦄 유니 경보: ${what}이에요. 되돌리기 어려우니 한 번 더 확인해 주세요.` }
  })

  on('prompt.submit', async ($, e, next) => {
    wake()
    await update($, view, v => ({ ...v, line: '요청을 읽고 생각하고 있어요 💭' }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    wake()
    const done = await next(e)
    if (e.reason === 'answer') {
      feel('happy', 3000)
      const v = await update($, view, x => ({
        ...x,
        line: '기다리고 있어요',
        bubble: x.mode === 'normal' ? pick(CHEERS) : x.bubble,
      }))
      sparkle(await read($, pet), v)
      await changePet($, p => ({
        ...p,
        xp: p.xp + 5,
        turns: p.turns + 1,
        full: clamp(p.full + 2),
        today: { ...p.today, turns: p.today.turns + 1 },
      }))
    } else {
      await update($, view, v => ({ ...v, line: '멈췄어요' }))
    }
    void refreshUsage($)
    return done
  })

  on('command.run', { command: 'yuni' }, async ($, e) => {
    const [sub = '', ...rest] = e.args.trim().split(/\s+/)
    const arg = rest.join(' ')
    const open = () => $.ui.open({ id: PANE, title: '유니' })
    if (sub === '숨') {
      await open()
      await startBreathing($)
      return { text: '숨쉬기 시작' }
    }
    if (sub === '쉬기') {
      await takeBreak($)
      return { text: '휴식 기록' }
    }
    if (sub === '오늘') {
      await open()
      await showToday($)
      return { text: '오늘 기록을 패널에 띄웠어요' }
    }
    if (sub === '이름' && arg) {
      const name = arg.slice(0, 12)
      await changePet($, p => ({ ...p, name }))
      await say($, `이제 제 이름은 ${name}예요!`)
      return { text: `이름: ${name}` }
    }
    if (sub === '알림' && Number(arg) > 0) {
      const breakMin = Math.min(240, Math.round(Number(arg)))
      await changePet($, p => ({ ...p, breakMin }))
      return { text: `휴식 알림: ${breakMin}분마다` }
    }
    if (sub === '정보줄') {
      const enabled = arg !== '끄기'
      await changePet($, p => ({ ...p, band: enabled }))
      return { text: `입력창 위 정보 줄: ${enabled ? '켜짐' : '꺼짐'}` }
    }
    const opened = await $.ui.open({ id: PANE, title: '유니', focus: true })
    return { text: opened.isPlaced ? '유니 패널' : '터미널을 넓히면 유니가 보여요' }
  })

  // ── 그리기: 패널 ──
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = await read($, pet)
    const v = await read($, view)
    const lv = levelOf(p.xp)
    const st = stageOf(p.turns)
    const nextStage = STAGES[st + 1]
    const columns = Math.max(24, Math.min(72, e.props.bodyColumns))

    let scene = <Text>{`🦄 ${p.name}`}</Text>
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      anim.columns = columns
      scene = <Raster key="scene" columns={columns} rows={ROWS} cells={toCells(frame(p, v))} />
    } else {
      const { Svg } = $.ui.resolve(e)
      scene = (
        <Svg
          source={toSvg(paintAt(p, v, columns))}
          alt={`${p.name}: ${STAGES[st]?.name}`}
          width={Math.min(520, columns * 9)}
        />
      )
    }

    const growth =
      st === 0
        ? p.turns >= CRACK_AT
          ? `🥚 금이 간 알 · 답변 ${STAGES[1].turns - p.turns}번 더 하면 부화`
          : `🥚 알 · 답변 ${CRACK_AT - p.turns}번 더 하면 금이 가요`
        : `🦄 ${p.branch} ${STAGES[st]?.name} · ${COATS[p.coat]?.name} 털${nextStage ? ` · 다음 진화까지 답변 ${nextStage.turns - p.turns}번` : ' · 최종 진화'}`

    if (v.mode === 'today') {
      const t = p.today
      const files = t.files.map(tail)
      return (
        <Box flexDirection="column">
          {scene}
          <Text bold>{`📅 오늘 (${t.day})`}</Text>
          <Text>{`답변 ${t.turns}번 · 도구 ${t.tools}번 · 휴식 ${t.breaks}번 · 막은 위험 ${t.guards}번`}</Text>
          <Text wrap="wrap">
            {files.length === 0
              ? '✏️ 오늘 고친 파일은 아직 없어요'
              : `✏️ 고친 파일 ${files.length}개: ${files.slice(-8).join(', ')}${files.length > 8 ? ' …' : ''}`}
          </Text>
          <Text dimColor>{`⏰ ${hhmm(t.firstAt)}부터 함께했어요${v.cost !== null ? ` · 이번 세션 비용 $${v.cost.toFixed(2)}` : ''}`}</Text>
          <Box gap={1}>
            <Button key="close-today" hotkey="1" variant="primary" label="닫기" onPress={() => closeToday($)} />
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {scene}
        {v.bubble !== '' && <Text color="magenta" wrap="wrap">{`💬 ${v.bubble}`}</Text>}
        {v.mode === 'breathe' && <Text bold>{`🌬️ ${v.breath}`}</Text>}
        <Text dimColor wrap="truncate-end">{`지금: ${v.line}`}</Text>
        <Text wrap="truncate-end">{growth}</Text>
        <Text wrap="truncate-end">
          {`⭐ Lv.${lv} (${p.xp}/${xpFor(lv + 1)}) · 💗 ${Math.round(p.happy)} · 🍬 ${Math.round(p.full)} · 🛡️ ${rankOf(p.guards)} (${p.guards})`}
        </Text>
        {v.friends.length > 0 && (
          <Text dimColor wrap="truncate-end">{`🥚 순찰대 ${v.friends.length}: ${v.friends.map(f => f.label).join(', ')}`}</Text>
        )}
        {v.mode === 'break' ? (
          <Box gap={1}>
            <Button key="rested" hotkey="1" variant="primary" label="쉬었어요" onPress={() => takeBreak($)} />
            <Button key="snooze" hotkey="2" label="10분 뒤에" onPress={() => snooze($)} />
          </Box>
        ) : (
          <Box gap={1} flexWrap="wrap">
            <Button key="pet" hotkey="1" label="쓰다듬기" onPress={() => petIt($)} />
            <Button key="feed" hotkey="2" label="간식" onPress={() => feed($)} />
            {v.mode === 'breathe' ? (
              <Button key="breath" hotkey="3" label="숨쉬기 그만" onPress={() => stopBreathing($)} />
            ) : (
              <Button key="breath" hotkey="3" label="숨쉬기" onPress={() => startBreathing($)} />
            )}
            <Button key="rest" hotkey="4" label="쉬었어요" onPress={() => takeBreak($)} />
            <Button key="today" hotkey="5" label="오늘" onPress={() => showToday($)} />
          </Box>
        )}
      </Box>
    )
  })

  // ── 그리기: 입력창 위 정보 줄 ──
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, pet)
    if (!p.band || e.props.hasSurvey) return next(e)
    // 다른 mod의 정보 줄을 덮지 않도록 아래 체인이 그린 것을 밑에 붙인다
    const below = await next(e)
    const v = await read($, view)
    const { Box, Text } = $.ui.resolve(e)
    const st = stageOf(p.turns)
    const ctx = v.context
    const ctxColor = ctx === null ? undefined : ctx >= 80 ? 'red' : ctx >= 60 ? 'yellow' : undefined
    const now = Date.now()
    const breakIn = Math.max(0, Math.round((Math.max(v.nextBreakAt, lastBreakAt + p.breakMin * 60_000) - now) / 60_000))
    const usage = [v.fiveHour !== null ? `5시간 ${Math.round(v.fiveHour)}%` : '', v.week !== null ? `주간 ${Math.round(v.week)}%` : '']
      .filter(Boolean)
      .join(' · ')
    return (
      <Box flexDirection="column">
      <Box gap={1}>
        <Text bold>{`🦄 ${p.name} ${st === 0 ? '알' : STAGES[st]?.name} Lv.${levelOf(p.xp)}`}</Text>
        <Text dimColor>│</Text>
        <Text wrap="truncate-end">{v.line}</Text>
        <Text dimColor>│</Text>
        <Text color={ctxColor} dimColor={ctxColor === undefined}>{`🧠 ${ctx === null ? '-' : ctx}%`}</Text>
        {usage !== '' && <Text dimColor>{`⏳ ${usage}`}</Text>}
        <Text dimColor>{v.mode === 'break' ? '☕ 쉬는 시간!' : `☕ ${breakIn}분`}</Text>
        {v.friends.length > 0 && <Text dimColor>{`🥚 ${v.friends.length}`}</Text>}
      </Box>
      {below}
      </Box>
    )
  })

  on('session.end', async ($, e, next) => {
    // ponytail: /clear도 session.end라서 타이머는 멈추지 않는다
    await $.store.set('pet', await read($, pet))
    return next(e)
  })
}

// Desktop은 blit이 없어서 상태가 바뀔 때마다 한 장씩 다시 그린다
function paintAt(p: Pet, v: View, columns: number) {
  const saved = anim.columns
  anim.columns = columns
  const painted = frame(p, v)
  anim.columns = saved
  return painted
}
