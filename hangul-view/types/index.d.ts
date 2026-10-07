export type HangulviewMarkdownArgs<Surface> = {
  surface: Surface
  text: string
  columns: number
}

export type Hangulview<Surface, Drawing> = {
  markdown: (args: HangulviewMarkdownArgs<Surface>) => Promise<Drawing | undefined>
}

declare module 'claude-code' {
  interface EngineInterface {
    hangulview: Hangulview<RenderSurface, RenderElement>
  }
}
