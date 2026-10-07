import { expect, test } from 'claude-code/testing'

import { mermaidText } from '../hooks/mermaid'
import { ko } from '../hooks/register'
import { clip, width } from '../hooks/render'

const mount = (text: string, columns = 120) => ({
  plugin: 'hangul-view',
  component: 'AssistantMessage' as const,
  props: { text, isFirstOfReply: true },
  viewport: { columns, rows: 40 },
  surface: 'terminal' as const,
})

test('한글 라벨이 있어도 mermaid 상자의 줄 폭이 맞는다', () => {
  const art = mermaidText('flowchart LR\n  R[답변] --> P[읽기]\n  P --> D[그리기 단계]\n  D --> S[Screen]', false, 160)
  expect(art).not.toBeNull()
  const lines = art!.split('\n')
  expect(lines.some(l => l.includes('그리기 단계'))).toBe(true)
  const widths = new Set(lines.map(l => width(l.trimEnd())))
  expect(widths.size).toBe(1)
  expect(/[-]/.test(art!)).toBe(false)
})

test('한글 분기 다이어그램도 상자 위아래가 같은 폭이다', () => {
  const art = mermaidText('flowchart TD\n  A[사용자 입력] --> B[저장]', false, 160)!
  const box = art.split('\n').filter(l => /[┌│└]/.test(l)).slice(0, 3).map(l => width(l.trimEnd()))
  expect(new Set(box).size).toBe(1)
})

test('도구 줄 대상은 앞의 cd를 떼고 48칸에서 자른다', () => {
  expect(clip('cd "/c/Users/me/project" && npm test')).toBe('npm test')
  const long = clip('echo ' + '가'.repeat(60))!
  expect(width(long)).toBeLessThanOrEqual(48)
  expect(long.endsWith('…')).toBe(true)
  expect(clip(undefined)).toBeUndefined()
})

test('힌트 줄과 모드 표시 문구를 한글로 바꾼다', () => {
  expect(ko('? for shortcuts')).toBe('? 단축키')
  expect(ko('esc to interrupt')).toBe('esc 중단')
  expect(ko('⏵⏵ auto mode on (shift+tab to cycle)')).toBe('⏵⏵ 자동 모드 (shift+tab 모드 바꾸기)')
  expect(ko('(ctrl+b to run in background)')).toBe('(ctrl+b 백그라운드에서 돌리기)')
  expect(ko('something new')).toBe('something new')
})

test('4줄 이상 코드에는 줄 번호, 옆 테두리는 없다', async $ => {
  const ui = await $.ui.mount(mount('```ts\nalpha()\nbeta()\ngamma()\ndelta()\n```'))
  expect(await ui.find({ type: 'Text', text: /^4$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /╭─/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Box' })).some(b => b.props.borderStyle !== undefined)).toBe(false)
  await ui.unmount()
})

test('codeLineNumbers를 끄면 줄 번호가 없다', { options: { codeLineNumbers: false } }, async $ => {
  const ui = await $.ui.mount(mount('```ts\nalpha()\nbeta()\ngamma()\ndelta()\n```'))
  expect(await ui.find({ type: 'Text', text: /^4$/ })).toBeUndefined()
  await ui.unmount()
})

test('한글 표는 칸 폭을 한글 2칸으로 계산한다', async $ => {
  const ui = await $.ui.mount(mount('| 상태 | 화면 |\n|---|---|\n| ✅ 지금 한글 | 도구 줄, 묶음 요약 |\n| ❌ 못 함 | 권한 확인 창 |'))
  const top = (await ui.find({ type: 'Text', text: /^┌/ }))?.text ?? ''
  const rule = (await ui.find({ type: 'Text', text: /^╞/ }))?.text ?? ''
  expect(top.length).toBeGreaterThan(0)
  expect(width(top)).toBe(width(rule))
  await ui.unmount()
})

test('칸이 여러 줄로 꺾이면 세로줄도 그만큼 길어진다', async $ => {
  const long = '부화할 때 털색 다섯 가지 중 하나가 무작위로 정해져서 매번 다른 유니콘이 나와요'
  const ui = await $.ui.mount(mount(`| 단계 | 메모 |\n|---|---|\n| 1 | ${long} |`, 40))
  const left = (await ui.findAll({ type: 'Text' })).filter(t => t.text === '│ ').length
  // 머리줄 1줄 + 꺾인 본문 여러 줄
  expect(left).toBeGreaterThanOrEqual(4)
  await ui.unmount()
})
