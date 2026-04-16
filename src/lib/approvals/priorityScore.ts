import type { DefaultPriorityConfig, PriorityConfigValues } from './types'

export const DEFAULT_LOCK_TIMEOUT_MINUTES = 5

export function calculatePriorityScore(submittedAt: Date, config: PriorityConfigValues): number {
  const now = Date.now()
  const submitted = submittedAt.getTime()

  if (submitted > now) {
    throw new Error('submittedAt cannot be in the future')
  }

  const ageInDays = (now - submitted) / (1000 * 60 * 60 * 24)
  return config.baseWeight + ageInDays * config.agingFactor
}

export function getDefaultPriorityConfig(): DefaultPriorityConfig[] {
  return [
    {
      category: 'P1',
      baseWeight: 100,
      agingFactor: 2.0,
      slaHours: 24,
      lockTimeoutMinutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
    },
    {
      category: 'P2',
      baseWeight: 75,
      agingFactor: 1.5,
      slaHours: 48,
      lockTimeoutMinutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
    },
    {
      category: 'P3',
      baseWeight: 50,
      agingFactor: 1.0,
      slaHours: 72,
      lockTimeoutMinutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
    },
    {
      category: 'P4',
      baseWeight: 25,
      agingFactor: 0.5,
      slaHours: 120,
      lockTimeoutMinutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
    },
  ]
}

export function isLockExpired(lockExpiresAt: Date | null): boolean {
  if (lockExpiresAt === null) return true
  return lockExpiresAt.getTime() <= Date.now()
}
