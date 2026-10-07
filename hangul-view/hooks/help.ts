export const showcaseText = (themes: readonly string[]): string => `
# prismantis

Colored markdown for Claude Code replies: **bold**, *italic*, ~~struck~~, \`inline code\`, a [link](https://github.com/NahumLitvin/prismantis) and a bare URL https://github.com/NahumLitvin/prismantis/issues, both clickable, numbers like 99.9% and 250ms, paths like ~/src/app.ts.

## Commands

| Command | Does |
|---------|------|
| \`/hangul\` | This screen |
| \`/hangul theme <name>\` | Switch theme on the spot |
| \`/hangul copy\` | Copy the last reply, or \`copy code\` for its last code block |
| \`/config\` | Edit any option |

> [!NOTE]
> ${themes.length} themes ship with it. \`mono\` uses no color, only bold and dim.

### Pick a theme

\`\`\`bash
/hangul theme nord
/hangul theme github-light
\`\`\`

1. Dark: ${themes.filter(t => !/latte|light|dawn/.test(t) && t !== 'mono').join(', ')}
2. Light: ${themes.filter(t => /latte|light|dawn/.test(t)).join(', ')}
3. Plain
   - mono

> [!TIP]
> Any color slot beats the theme. Set \`headingColor\` or \`numberColor\` to a hex value in \`/config\`.

## Everything it draws

### Alerts

> [!IMPORTANT]
> After updating the plugin, open sessions need \`/reload\`.

> [!WARNING]
> Terminals that copy on select (Warp) can turn a click on a copy button into a selection. Use the keyboard shortcut.

> [!CAUTION]
> Claude Code refuses trees over 20000 nodes. A code block past about 500 highlighted lines falls back to plain text.

### Task lists

- [x] Parse the reply
- [x] Draw it
  - [x] Tables and code
  - [ ] Diagrams on the desktop app
- [ ] Ship the next release

### Your prompts

Scroll up: what you typed draws in a bubble. \`promptStyle\` switches to \`bar\`, \`chevron\` or \`off\` in \`/config\`.

### Tool rows

Tool calls draw as one line, dimmed on the right by default. Set \`toolStyle\` in \`/config\` to \`chat\`, \`tree-dim\`, \`tree-bold\` or \`classic\`.

### Quotes and rules

> A quote keeps its text when you copy it, without the \`> \` markers.

---

### Code

\`\`\`json
{ "theme": "dracula", "headingStyle": "banner", "mermaid": true }
\`\`\`

#### Diagrams

\`\`\`mermaid
flowchart LR
    R[Reply] --> P[Parse]
    P --> D[Draw]
    D --> S[Screen]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant U as You
    participant C as Claude
    participant P as prismantis
    U->>C: prompt
    C->>P: markdown
    P-->>U: colored reply
\`\`\`

\`\`\`mermaid
xychart-beta
    title "Color options per group"
    x-axis [text, head, num, code, diag]
    y-axis "options" 0 --> 8
    bar [7, 3, 2, 6, 2]
\`\`\`
`

export const helpText = (themes: readonly string[]): string => `
## 한글 화면 명령어

| 명령어 | 하는 일 |
|--------|---------|
| \`/hangul theme <이름>\` | 테마를 바로 바꿔요 |
| \`/hangul copy\` | 마지막 답변을 복사해요. \`copy code\`는 마지막 코드 블록만 |
| \`/hangul demo\` | 표, 코드, 다이어그램을 전부 그려서 보여줘요 |
| \`/config\` | 색, 표 모양, 입력 말풍선 같은 옵션을 하나씩 바꿔요 |

### 테마 ${themes.length}가지

- 어두운 테마: ${themes.filter(t => !/latte|light|dawn/.test(t) && t !== 'mono').join(', ')}
- 밝은 테마: ${themes.filter(t => /latte|light|dawn/.test(t)).join(', ')}
- 단색: mono (굵게와 흐리게만 써요)

> [!TIP]
> 테마보다 개별 색이 먼저예요. \`/config\`에서 \`headingColor\`나 \`numberColor\`에 색을 넣어 보세요.

### 할 일 목록

- [x] 표, 다이어그램, 차트를 터미널에 그려요
- [x] 모든 블록에 복사 버튼이 있어요
- [ ] \`/config\`의 \`taskStyle\`에서 체크 모양을 골라요

\`\`\`mermaid
flowchart LR
    R[답변] --> P[읽기]
    P --> D[그리기]
    D --> S[화면]
\`\`\`

원작: prismantis (MIT, https://github.com/NahumLitvin/prismantis)
`

export const rtlShowcaseText = (): string => `
# עברית מימין לשמאל

**שלום חברים**, זו הדגמה של עברית עם מונחים באנגלית כמו \`kubectl\`, מספרים כמו 99.9% ו-250ms, נתיב כמו ~/src/app.ts וגם [קישור](https://github.com/NahumLitvin/prismantis).

## רשימות

- פרוסים בשני אזורים (us-east ו-eu-west)
- מחליפים ערכת נושא עם \`/hangul theme nord\`

1. מתקינים את התוסף
2. שואלים שאלה בעברית

> עברית נקראת מימין לשמאל, גם בטרמינל בלי תמיכה בכיווניות

> [!TIP]
> כל ערכת נושא עובדת גם בעברית

| שירות | אזור | גרסה |
| :--- | :--- | ---: |
| שער | us-east | 2.14.0 |
| חיוב | eu-west | 1.8.3 |

\`\`\`bash
ls -la # רשימת הקבצים בתיקייה
\`\`\`
`
