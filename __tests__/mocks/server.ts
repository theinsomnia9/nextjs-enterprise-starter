import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup MSW server for Node.js (tests)
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Close server after all tests
afterAll(() => server.close())
