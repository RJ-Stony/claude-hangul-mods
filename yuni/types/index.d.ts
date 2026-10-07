export type DayLog = {
  day: string
  turns: number
  tools: number
  files: string[]
  breaks: number
  guards: number
  firstAt: number
}

export type Pet = {
  name: string
  xp: number
  happy: number
  full: number
  turns: number
  branch: '알' | '불꽃' | '바람' | '강철'
  coat: number
  counts: { edit: number; search: number; bash: number }
  guards: number
  breaks: number
  streak: number
  lastDay: string
  breakMin: number
  band: boolean
  today: DayLog
}

export type Friend = { id: string; label: string; since: number }

export type View = {
  line: string
  bubble: string
  mode: 'normal' | 'break' | 'breathe' | 'today'
  breath: string
  startedAt: number
  nextBreakAt: number
  friends: Friend[]
  context: number | null
  fiveHour: number | null
  week: number | null
  cost: number | null
}

declare module 'claude-code' {
  interface PluginState {
    yuni: { pet: Pet; view: View }
  }
}
