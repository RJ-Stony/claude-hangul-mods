import type { EngineInterface, Register, RenderElement } from 'claude-code'

import { parse } from './markdown'
import { boxArt, mermaidText } from './mermaid'
import type { Drawn } from './render'
import { remember, renderBlocks, renderExpandedShell, renderToolGroup, renderToolRow, renderTurnDuration, renderUserPrompt, width } from './render'
import { helpText, rtlShowcaseText, showcaseText } from './help'
import { PRESET_NAMES } from './presets'
import type { Style } from './theme'
import { resolveStyle } from './theme'
import type { Terminal } from './rtl'
import { TERMINALS, hasRtl } from './rtl'

const HINT = [
  'Replies in this session are drawn by the prismantis mod, which runs inside Claude Code and is not a command or tool to call: when the user asks to show something with prismantis, write it as markdown in the reply.',
  'Markdown tables, GitHub alerts (> [!WARNING], > [!NOTE]), fenced code with a language tag, and ```mermaid blocks render as colored terminal graphics:',
  'flowcharts, sequence diagrams and xychart-beta bar or line charts.',
  'When a reply carries a numeric series or a flow that is easier to see than read, add one small diagram or chart with short labels.',
  'Skip diagrams for simple answers.',
  'Put any command or snippet the user may run or copy in a fenced block with a language tag, never inline code: fenced blocks get a copy button, inline code does not.',
].join(' ')

const detectTerminal = async ($: EngineInterface): Promise<Terminal | null> => {
  const program = await $.env.get('TERM_PROGRAM')
  const term = await $.env.get('TERM')
  if ((await $.env.get('KITTY_WINDOW_ID')) || term === 'xterm-kitty') return 'kitty'
  if (program === 'Apple_Terminal') return 'apple-terminal'
  if (program === 'WarpTerminal') return 'warp'
  if (program === 'ghostty') return 'ghostty'
  if (program === 'WezTerm') return 'wezterm'
  if (program === 'vscode') return 'vscode'
  if (program === 'iTerm.app') return 'iterm'
  if (term === 'alacritty' || (await $.env.get('ALACRITTY_WINDOW_ID'))) return 'alacritty'
  if (await $.env.get('WT_SESSION')) return 'windows-terminal'
  if (await $.env.get('VTE_VERSION')) return 'gnome'
  if (await $.env.get('KONSOLE_VERSION')) return 'konsole'
  return null
}

const applyRtl = async ($: EngineInterface, style: Style): Promise<void> => {
  if (style.rtl !== 'auto') return
  const terminal = await detectTerminal($)
  style.reorder = terminal !== null
  if (terminal) style.shape = TERMINALS[terminal]
}

const expandedCalls = new Set<string>()

const drawMarkdown = ($: EngineInterface, el: ReturnType<EngineInterface['ui']['resolve']>, style: Style, blocks: ReturnType<typeof parse>, columns: number, reply?: string): RenderElement[] => {
  const { Button } = el
  const copy = (text: string | (() => string), key: string, label = '⧉ 복사') =>
    style.copyButtons ? (
      <Button
        key={key}
        variant="primary"
        label={label}
        onPress={press => {
          $.ui.copy({ text: typeof text === 'function' ? text() : text, surface: press.surface })
            .then(r => $.ui.toast(r.isCopied ? '복사했어요' : `복사 실패: ${r.reason}`))
            .catch(() => $.ui.toast('Copy failed'))
        }}
      />
    ) : null
  const drawn: Drawn = new Map()
  if (style.mermaid) {
    for (const [i, block] of blocks.entries()) {
      if (block.kind !== 'code' || block.lang.toLowerCase() !== 'mermaid') continue
      const art = mermaidText(block.lines.join('\n'), style.mermaidAscii, columns)
      if (art !== null && art.split('\n').every(l => width(l) <= columns - 2)) drawn.set(i, { element: boxArt(el, style, art, `b${i}`), art })
    }
  }
  const elements = renderBlocks(el, style, blocks, columns, drawn, copy)
  const button = reply === undefined ? null : copy(reply, 'reply', '⧉ 답변 복사')
  return button ? [...elements, <el.Box key="reply" alignSelf="flex-end">{button}</el.Box>] : elements
}

const SPINNER_KO: Record<string, string> = {
  thinking: '생각하는 중',
  requesting: '요청 보내는 중',
  responding: '답변 쓰는 중',
  'tool-input': '도구 준비하는 중',
  'tool-use': '도구 쓰는 중',
}

// 입력창 아래 힌트 줄, 모드 표시, 백그라운드 안내에 나오는 영어 문구. 모르는 문구는 그대로 둔다.
const PHRASES: [RegExp, string][] = [
  [/\? for shortcuts/gi, '? 단축키'],
  [/esc to interrupt/gi, 'esc 중단'],
  [/esc to cancel/gi, 'esc 취소'],
  [/(press )?ctrl[+-]c again to exit/gi, 'ctrl+c 한 번 더 누르면 종료'],
  [/ctrl\+c to exit/gi, 'ctrl+c 종료'],
  [/shift\+tab to cycle/gi, 'shift+tab 모드 바꾸기'],
  [/auto mode on/gi, '자동 모드'],
  [/accept edits on/gi, '수정 자동 허용'],
  [/plan mode on/gi, '계획 모드'],
  [/bypass permissions on/gi, '권한 확인 건너뛰기'],
  [/ctrl\+o to expand/gi, 'ctrl+o 펼치기'],
  [/ctrl\+r to search history/gi, 'ctrl+r 기록 검색'],
  [/tab to amend/gi, 'tab 고치기'],
  [/to run in background/gi, '백그라운드에서 돌리기'],
  [/enter to (submit|send)/gi, 'enter 보내기'],
  [/queued messages?/gi, '대기 중인 메시지'],
  [/memory paused/gi, '메모리 멈춤'],
  [/^focus$/i, '집중'],
]
export const ko = (text: string) => PHRASES.reduce((out, [re, word]) => out.replace(re, word), text)

export const register: Register = (on, options) => {
  on('engine.create', async (_$, e, next) => ({ ...(await next(e)), hangulview: { markdown: async () => undefined } }))
  if (options.enabled === false) return
  const style = resolveStyle(options)
  const parsed = new Map<string, ReturnType<typeof parse>>()
  const parseCached = (text: string, cache = parsed, limit?: number) => remember(cache, text, () => parse(text, { numbers: style.highlightNumbers, paths: style.highlightPaths }), limit)
  const shared = new Map<string, ReturnType<typeof parse>>()

  if (options.toolRows !== false) {
    on('ui.render', { component: 'ToolGroup' }, ($, e, next) => {
      if (e.props.isExpanded) {
        for (const call of e.props.calls) if (call.tool_use_id) expandedCalls.add(call.tool_use_id)
        return next(e)
      }
      return renderToolGroup($.ui.resolve(e), style, e.props.calls, e.props.isActive, e.viewport?.columns)
    })
    on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
      if (!expandedCalls.has(e.props.tool_use_id)) return renderToolRow($.ui.resolve(e), style, e.props, e.viewport?.columns)
      return e.props.tool === 'Bash' || e.props.tool === 'PowerShell' ? renderExpandedShell($.ui.resolve(e), style, e.props) : next(e)
    })
  }

  on('session.start', async ($, e, next) => {
    await applyRtl($, style)
    const started = await next(e)
    await $.command
      .register({ name: 'hangul', description: '한글 화면: 테마 바꾸기, 마지막 답변 복사, 미리보기', argumentHint: '[theme <이름> | copy [code] | demo]' })
      .catch(() => undefined)
    return started
  })

  on('command.run', { command: 'hangul' }, async ($, e) => {
    const [sub, name] = e.args.trim().split(/\s+/)
    if (sub === 'demo') return { text: showcaseText(PRESET_NAMES) }
    if (sub === 'copy') {
      const reply = (await $.session.messages()).findLast(m => m.role === 'assistant' && m.text.trim())
      if (!reply) return { text: '아직 복사할 답변이 없어요.' }
      const code = name === 'code' ? parseCached(reply.text).findLast(b => b.kind === 'code') : undefined
      if (name === 'code' && code?.kind !== 'code') return { text: '마지막 답변에 코드 블록이 없어요.' }
      const result = await $.ui.copy({ text: code?.kind === 'code' ? code.lines.join('\n') : reply.text })
      return { text: result.isCopied ? `마지막 ${code ? '코드 블록' : '답변'}을 복사했어요.` : `복사 실패: ${result.reason}` }
    }
    if (sub === 'demo-rtl') {
      await applyRtl($, style)
      return { text: rtlShowcaseText() }
    }
    if (sub !== 'theme' || !name) return { text: helpText(PRESET_NAMES) }
    if (!(PRESET_NAMES as readonly string[]).includes(name)) return { text: `"${name}" 테마는 없어요. 테마 목록: ${PRESET_NAMES.join(', ')}` }
    const result = await $.config.set({ key: `${$.plugin.name}.theme`, value: name })
    return { text: result.deny ? `테마를 바꾸지 못했어요: ${result.deny}` : `테마를 ${name}(으)로 바꿨어요.` }
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e) => renderTurnDuration($.ui.resolve(e), style, e.props.word, e.props.durationMs))

  // 힌트 줄: 바꿀 문구가 있을 때만 다시 쓴다 (없으면 엔진의 살아 있는 버튼을 그대로 둔다)
  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    const hint = ko(e.props.hint)
    return hint === e.props.hint ? next(e) : next({ ...e, props: { ...e.props, hint } })
  })

  on('ui.render', { component: 'SessionMode' }, ($, e, next) => next({ ...e, props: { ...e.props, modes: e.props.modes.map(ko) } }))

  on('ui.render', { component: 'InfoNotice' }, ($, e, next) => next({ ...e, props: { ...e.props, text: ko(e.props.text) } }))

  on('ui.render', { component: 'ToolProgress' }, ($, e, next) => next({ ...e, props: { ...e.props, hint: ko(e.props.hint) } }))

  // 스피너 문구 한글화 (유니에서 옮겨옴)
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.message !== null) return next(e)
    return next({ ...e, props: { ...e.props, word: SPINNER_KO[e.props.mode] ?? e.props.word } })
  })

  on('prompt.submit', async ($, e, next) => {
    await applyRtl($, style)
    if (!style.diagramHints || (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge')) return next(e)
    return next({ ...e, context: [...(e.context ?? []), HINT] })
  })

  on('ui.render', { component: 'CommandOutput' }, ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const blocks = parseCached(e.props.text)
    if (blocks.length === 0) return next(e)
    const el = $.ui.resolve(e)
    const { Box } = el
    const columns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    return <Box flexDirection="column" rowGap={1} {...(style.reorder && hasRtl(e.props.text) ? { width: '100%' } : {})}>{drawMarkdown($, el, style, blocks, columns)}</Box>
  })

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    const kind = e.props.origin.kind
    const own = kind === 'composer' || kind === 'bridge' || (kind === 'unclassified' && !e.props.from && !e.props.task)
    if (style.promptStyle === 'off' || !own) return next(e)
    return renderUserPrompt($.ui.resolve(e), style, e.props.text, Math.max(20, (e.viewport?.columns ?? 100) - 4))
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const blocks = parseCached(e.props.text)
    if (blocks.length === 0) return next(e)
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const columns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    const narration = style.toolStyle === 'tree-bold' && blocks.length === 1 && blocks[0]!.kind === 'paragraph'
    return (
      <Box flexDirection="row" marginTop={1}>
        <Box width={2} flexShrink={0}>
          <Text color={style.theme.accent}>{e.props.isFirstOfReply ? '●' : ' '}</Text>
        </Box>
        <Box flexDirection="column" rowGap={1} flexGrow={1}>
          {drawMarkdown($, el, narration ? { ...style, narration } : style, blocks, columns, blocks.length > 1 || hasRtl(e.props.text) ? e.props.text : undefined)}
        </Box>
      </Box>
    )
  })

  on('hangulview.markdown', ($, e, next) => {
    const blocks = parseCached(e.text, shared, 20)
    if (blocks.length === 0) return next(e)
    const el = $.ui.resolve({ surface: e.surface, component: 'AssistantMessage' })
    const { Box } = el
    return { value: <Box flexDirection="column" rowGap={1} {...(style.reorder && hasRtl(e.text) ? { width: '100%' } : {})}>{drawMarkdown($, el, { ...style, copyButtons: false }, blocks, Math.max(20, e.columns || 0))}</Box> }
  })
}
