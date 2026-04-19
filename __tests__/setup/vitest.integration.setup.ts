import { vi } from 'vitest'

// Suppress console noise in integration tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
}
