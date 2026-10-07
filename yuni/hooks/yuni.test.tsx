import { describe, expect, mock, test } from 'claude-code/testing'

import { branchFrom, dangerOf } from './register'

const PANE = {
  plugin: 'yuni',
  component: 'Pane',
  requestId: 'yuni',
  props: { title: '유니', isFocused: true, bodyColumns: 48, placement: 'dock', scroll: { bodyRows: 30, offset: 0 }, view: {} },
} as const

describe('규칙', () => {
  test('위험한 명령어만 잡는다', () => {
    expect(dangerOf('rm -rf node_modules')).toBeDefined()
    expect(dangerOf('git push --force origin main')).toBeDefined()
    expect(dangerOf('git reset --hard HEAD~1')).toBeDefined()
    expect(dangerOf('Remove-Item -Path dist -Recurse -Force')).toBeDefined()
    expect(dangerOf('npm test')).toBeUndefined()
    expect(dangerOf('git push origin main')).toBeUndefined()
    expect(dangerOf('rm notes.txt')).toBeUndefined()
  })

  test('제일 많이 한 일로 갈래가 정해진다', () => {
    expect(branchFrom({ edit: 9, search: 3, bash: 2 })).toBe('불꽃')
    expect(branchFrom({ edit: 1, search: 9, bash: 2 })).toBe('바람')
    expect(branchFrom({ edit: 1, search: 2, bash: 9 })).toBe('강철')
  })
})

test('허락된 위험 명령어도 한 번 더 묻게 바꾼다', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: Date.parse('2026-10-07T14:00:00') })
  on('tool.check', () => ({ decision: 'allow' as const }))
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' } })).decision).toBe('ask')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })).decision).toBe('allow')
})

test('패널: 한글로 그려지고 버튼이 동작한다', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: Date.parse('2026-10-07T14:00:00') })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /답변 20번 더 하면 금이 가요/ })).toBeDefined()
    expect(await ui.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })).toBeDefined()
    await ui.press({ key: 'pet' })
    expect(await ui.find({ text: /💬/ })).toBeDefined()
    await ui.press({ key: 'breath' })
    expect(await ui.find({ text: /🌬️ 들이마셔요/ })).toBeDefined()
    await ui.press({ key: 'breath' })
    await ui.press({ key: 'today' })
    expect(await ui.find({ text: /📅 오늘/ })).toBeDefined()
    await ui.press({ key: 'close-today' })
    await ui.unmount()
  }
})

test('입력창 위 정보 줄', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: Date.parse('2026-10-07T14:00:00') })
  // 실제 세션에서는 엔진이 맨 아래에서 빈 줄을 그린다
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const band = await $.ui.mount({
    plugin: 'yuni',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { bodyRows: 4, offset: 0 }, view: {} },
  })
  expect(await band.find({ text: /🦄 유니 알 Lv\.1/ })).toBeDefined()
  expect(await band.find({ text: /🧠/ })).toBeDefined()
  await band.unmount()

})

test('다른 mod의 정보 줄을 덮지 않는다', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: Date.parse('2026-10-07T14:00:00') })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>다른 mod 줄</Text>
  })
  const band = await $.ui.mount({
    plugin: 'yuni',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { bodyRows: 4, offset: 0 }, view: {} },
  })
  expect(await band.find({ text: /🦄 유니/ })).toBeDefined()
  expect(await band.find({ text: '다른 mod 줄' })).toBeDefined()
  await band.unmount()

})
