import { vi } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.test', override: true })

global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
}
