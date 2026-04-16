import { describe, it, expect } from 'vitest'
import {
  calculatePriorityScore,
  getDefaultPriorityConfig,
  isLockExpired,
  DEFAULT_LOCK_TIMEOUT_MINUTES,
} from '@/lib/approvals/priorityScore'
import type { PriorityConfigValues, DefaultPriorityConfig } from '@/lib/approvals/types'

const P1_CONFIG: PriorityConfigValues = {
  baseWeight: 100,
  agingFactor: 2.0,
  slaHours: 24,
  lockTimeoutMinutes: 5,
}

const P4_CONFIG: PriorityConfigValues = {
  baseWeight: 25,
  agingFactor: 0.5,
  slaHours: 120,
  lockTimeoutMinutes: 5,
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000)
}

describe('calculatePriorityScore', () => {
  it('returns baseWeight for a brand-new request (age ≈ 0)', () => {
    const score = calculatePriorityScore(new Date(), P1_CONFIG)
    expect(score).toBeCloseTo(100, 0)
  })

  it('increases score as request ages', () => {
    const freshScore = calculatePriorityScore(new Date(), P1_CONFIG)
    const oldScore = calculatePriorityScore(daysAgo(5), P1_CONFIG)
    expect(oldScore).toBeGreaterThan(freshScore)
  })

  it('P1 at 5 days scores ~110 (100 + 5*2.0)', () => {
    const score = calculatePriorityScore(daysAgo(5), P1_CONFIG)
    expect(score).toBeCloseTo(110, 0)
  })

  it('P4 at 30 days scores ~40 (25 + 30*0.5)', () => {
    const score = calculatePriorityScore(daysAgo(30), P4_CONFIG)
    expect(score).toBeCloseTo(40, 0)
  })

  it('P4 at 30 days (40) is still LOWER than fresh P1 (100)', () => {
    const freshP1 = calculatePriorityScore(new Date(), P1_CONFIG)
    const oldP4 = calculatePriorityScore(daysAgo(30), P4_CONFIG)
    expect(oldP4).toBeLessThan(freshP1)
  })

  it('P4 at 150 days (~100) is approximately EQUAL to fresh P1 (100)', () => {
    const freshP1 = calculatePriorityScore(new Date(), P1_CONFIG)
    const oldP4 = calculatePriorityScore(daysAgo(150), P4_CONFIG)
    expect(oldP4).toBeCloseTo(freshP1, -1)
  })

  it('P4 at 200 days (~125) SURPASSES fresh P1 (100)', () => {
    const freshP1 = calculatePriorityScore(new Date(), P1_CONFIG)
    const oldP4 = calculatePriorityScore(daysAgo(200), P4_CONFIG)
    expect(oldP4).toBeGreaterThan(freshP1)
  })

  it('uses agingFactor of 0 to always return baseWeight', () => {
    const config: PriorityConfigValues = { ...P1_CONFIG, agingFactor: 0 }
    const score = calculatePriorityScore(daysAgo(999), config)
    expect(score).toBeCloseTo(100, 0)
  })

  it('throws for a future submittedAt date', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000)
    expect(() => calculatePriorityScore(future, P1_CONFIG)).toThrow()
  })
})

describe('getDefaultPriorityConfig', () => {
  it('returns config for all four categories', () => {
    const configs = getDefaultPriorityConfig()
    const categories = configs.map((c) => c.category)
    expect(categories).toContain('P1')
    expect(categories).toContain('P2')
    expect(categories).toContain('P3')
    expect(categories).toContain('P4')
  })

  it('P1 has highest baseWeight', () => {
    const configs = getDefaultPriorityConfig()
    const p1 = configs.find((c) => c.category === 'P1')!
    const others = configs.filter((c) => c.category !== 'P1')
    others.forEach((c: DefaultPriorityConfig) =>
      expect(p1.baseWeight).toBeGreaterThan(c.baseWeight)
    )
  })

  it('P1 has highest agingFactor', () => {
    const configs = getDefaultPriorityConfig()
    const p1 = configs.find((c) => c.category === 'P1')!
    const others = configs.filter((c) => c.category !== 'P1')
    others.forEach((c: DefaultPriorityConfig) =>
      expect(p1.agingFactor).toBeGreaterThan(c.agingFactor)
    )
  })

  it('P4 has lowest baseWeight and agingFactor', () => {
    const configs = getDefaultPriorityConfig()
    const p4 = configs.find((c) => c.category === 'P4')!
    const others = configs.filter((c) => c.category !== 'P4')
    others.forEach((c: DefaultPriorityConfig) => {
      expect(p4.baseWeight).toBeLessThan(c.baseWeight)
      expect(p4.agingFactor).toBeLessThan(c.agingFactor)
    })
  })
})

describe('isLockExpired', () => {
  it('returns true when lockExpiresAt is in the past', () => {
    expect(isLockExpired(minutesAgo(6))).toBe(true)
  })

  it('returns false when lockExpiresAt is in the future', () => {
    const future = new Date(Date.now() + 5 * 60 * 1000)
    expect(isLockExpired(future)).toBe(false)
  })

  it('returns true when lockExpiresAt is null', () => {
    expect(isLockExpired(null)).toBe(true)
  })

  it('returns false when lockExpiresAt is exactly now (within 1s)', () => {
    const nearFuture = new Date(Date.now() + 500)
    expect(isLockExpired(nearFuture)).toBe(false)
  })
})

describe('DEFAULT_LOCK_TIMEOUT_MINUTES', () => {
  it('is 5 minutes', () => {
    expect(DEFAULT_LOCK_TIMEOUT_MINUTES).toBe(5)
  })
})
