export type DemoStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE' | 'ERROR'
export type DemoSpeed = 1 | 2 | 3

export type DemoStep = {
  id: string
  label: string
  narration: string
  durationMs: number
  route: string
  action: (ctx: DemoContext) => Promise<void>
}

export type DemoContext = {
  users: Record<string, { id: string; email: string; username: string }>
  cellId: string | null
  briefId: string | null
  publicationId: string | null
  push: (route: string) => void
  highlight: (elementId: string | null) => void
  fillForm: (selector: string, value: string) => void
  signIn: (email: string) => Promise<void>
  callApi: (op: string, body?: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export type DemoState = {
  status: DemoStatus
  currentStepIndex: number
  totalSteps: number
  speed: DemoSpeed
  stepLabel: string
  stepNarration: string
  stepProgress: number // 0-1, time elapsed in current step
  errorMessage?: string
}
