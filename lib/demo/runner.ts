import { createClient } from '@/lib/supabase/client'
import { DEMO_PASSWORD } from './constants'
import type { DemoStep, DemoStatus, DemoSpeed, DemoContext, DemoState } from './types'

export class DemoRunner {
  private steps: DemoStep[]
  private status: DemoStatus = 'IDLE'
  private currentStepIndex = 0
  private speed: DemoSpeed = 1
  private listeners: Array<(state: DemoState) => void> = []
  private stepTimer: ReturnType<typeof setInterval> | null = null
  private stepStartTime = 0
  private stepDuration = 0
  private pushFn: (route: string) => void
  private refreshFn: () => void

  // Demo context mutable state
  private ctx: DemoContext

  constructor(pushFn: (route: string) => void, refreshFn: () => void = () => {}) {
    this.pushFn = pushFn
    this.refreshFn = refreshFn
    this.steps = []
    this.ctx = this.buildContext()
  }

  setSteps(steps: DemoStep[]) {
    this.steps = steps
  }

  private buildContext(): DemoContext {
    return {
      users: {},
      cellId: null,
      briefId: null,
      publicationId: null,
      push: this.pushFn,
      refresh: this.refreshFn,
      highlight: (id) => {
        if (typeof document === 'undefined') return
        if (id) document.body.setAttribute('data-demo-highlight', id)
        else document.body.removeAttribute('data-demo-highlight')
      },
      fillForm: (selector, value) => {
        if (typeof document === 'undefined') return
        const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null
        if (!el) return
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
        if (setter) {
          setter.call(el, value)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      },
      signIn: async (email) => {
        const supabase = createClient()
        await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
        await new Promise<void>((r) => setTimeout(r, 800))
      },
      callApi: async (op, body = {}) => {
        const res = await fetch('/api/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op, ...body }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          console.error(`[demo] ${op} failed:`, json.error ?? res.status)
          throw new Error(`${op}: ${json.error ?? res.status}`)
        }
        return json
      },
    }
  }

  subscribe(fn: (state: DemoState) => void) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn)
    }
  }

  private errorMessage: string | undefined = undefined

  private emit() {
    const step = this.steps[this.currentStepIndex]
    const elapsed =
      this.stepTimer && this.stepDuration > 0
        ? (Date.now() - this.stepStartTime) / this.stepDuration
        : 0
    const state: DemoState = {
      status: this.status,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.steps.length,
      speed: this.speed,
      stepLabel: step?.label ?? '',
      stepNarration: step?.narration ?? '',
      stepProgress: Math.min(1, elapsed),
      errorMessage: this.errorMessage,
    }
    this.listeners.forEach((fn) => fn(state))
  }

  async play() {
    if (this.status === 'COMPLETE') return
    if (this.status === 'ERROR') {
      // Clear error and retry from idle
      this.status = 'IDLE'
      this.errorMessage = undefined
    }
    if (this.status === 'IDLE') {
      // Initialize context
      const state = await this.ctx.callApi('get-state')
      if (state.users) this.ctx.users = state.users as DemoContext['users']
      this.ctx.cellId = (state.cellId as string) ?? null
      this.ctx.briefId = (state.briefId as string) ?? null
      this.ctx.publicationId = (state.publicationId as string) ?? null

      // Preflight: verify demo accounts exist
      if (Object.keys(this.ctx.users).length === 0) {
        this.status = 'ERROR'
        this.errorMessage = 'Demo accounts not found. Run `npm run seed:demo` then refresh.'
        this.emit()
        return
      }
    }
    this.status = 'RUNNING'
    this.emit()
    await this.runFromCurrent()
  }

  pause() {
    this.status = 'PAUSED'
    if (this.stepTimer) {
      clearInterval(this.stepTimer)
      this.stepTimer = null
    }
    this.emit()
  }

  async skipToStep(n: number) {
    if (this.stepTimer) {
      clearInterval(this.stepTimer)
      this.stepTimer = null
    }
    this.currentStepIndex = Math.max(0, Math.min(n, this.steps.length - 1))
    this.emit()
    if (this.status === 'RUNNING') await this.runFromCurrent()
  }

  setSpeed(s: DemoSpeed) {
    this.speed = s
    this.emit()
  }

  async reset() {
    if (this.stepTimer) {
      clearInterval(this.stepTimer)
      this.stepTimer = null
    }
    await this.ctx.callApi('reset')
    this.status = 'IDLE'
    this.currentStepIndex = 0
    this.ctx = this.buildContext()
    this.emit()
    this.pushFn('/')
  }

  private async runFromCurrent() {
    while (this.currentStepIndex < this.steps.length && this.status === 'RUNNING') {
      const step = this.steps[this.currentStepIndex]
      this.ctx.highlight(null)

      // navigate
      this.pushFn(step.route)
      await new Promise<void>((r) => setTimeout(r, 400))

      // run action
      try {
        await step.action(this.ctx)
      } catch (e) {
        console.error(`Demo step ${step.id} failed:`, e)
        this.status = 'ERROR'
        this.errorMessage = `Step "${step.label}" failed: ${e instanceof Error ? e.message : String(e)}`
        this.emit()
        return
      }

      // wait duration (with progress ticking)
      const duration = step.durationMs / this.speed
      this.stepDuration = duration
      this.stepStartTime = Date.now()
      this.emit()

      await new Promise<void>((resolve) => {
        const tickMs = 100
        this.stepTimer = setInterval(() => {
          this.emit()
          if (Date.now() - this.stepStartTime >= duration) {
            clearInterval(this.stepTimer!)
            this.stepTimer = null
            resolve()
          }
        }, tickMs)
      })

      if (this.status !== 'RUNNING') break

      this.ctx.highlight(null)
      this.currentStepIndex++
      this.emit()
    }

    if (this.currentStepIndex >= this.steps.length) {
      this.status = 'COMPLETE'
      this.emit()
    }
  }
}
