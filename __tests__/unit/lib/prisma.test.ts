import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrismaClient = vi.fn(function () {
  return { $connect: vi.fn(), $disconnect: vi.fn() }
})

vi.mock('@prisma/client', () => ({
  PrismaClient: mockPrismaClient,
}))

describe('prisma singleton', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    // Clean up global prisma
    const g = globalThis as unknown as { prisma: unknown }
    delete g.prisma
  })

  it('should create a new PrismaClient instance', async () => {
    const mod = await import('@/lib/prisma')

    expect(mod.prisma).toBeDefined()
    expect(mockPrismaClient).toHaveBeenCalled()
  })

  it('should reuse existing global prisma instance', async () => {
    const existingClient = { $connect: vi.fn(), $disconnect: vi.fn() }
    const g = globalThis as unknown as { prisma: unknown }
    g.prisma = existingClient

    const mod = await import('@/lib/prisma')

    expect(mod.prisma).toBe(existingClient)
  })

  it('should store prisma on globalThis in non-production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const mod = await import('@/lib/prisma')
    const g = globalThis as unknown as { prisma: unknown }

    expect(g.prisma).toBe(mod.prisma)

    process.env.NODE_ENV = originalEnv
  })
})
