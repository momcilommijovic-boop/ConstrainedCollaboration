import { EzineStrategy, parseEzineConfig } from './ezine'
import type { StrategyEngine } from './types'

/**
 * Registry of all supported strategies.
 * Add new strategies here — the lifecycle runner stays unchanged.
 *
 * `raw` is the `strategy_config` jsonb value from the `cells` table.
 */
export function getStrategy(strategyId: string, raw: unknown): StrategyEngine {
  switch (strategyId) {
    case 'EZINE_V1':
      return new EzineStrategy(parseEzineConfig(raw))
    default:
      throw new Error(`Unknown strategy: "${strategyId}"`)
  }
}

export type { StrategyEngine } from './types'
export type { EzineStrategyConfig } from './ezine'
export { EzineStrategyConfigSchema } from './ezine'
