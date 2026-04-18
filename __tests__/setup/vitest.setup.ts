import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

// Suppress console errors in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock EventSource for SSE tests
class MockEventSource {
  url: string
  readyState: number = 0
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  private listeners: Map<string, EventListener[]> = new Map()

  constructor(url: string) {
    this.url = url
    this.readyState = 1
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.(new Event('open'))
    }, 0)
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) || []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) || []
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
    this.listeners.set(type, listeners)
  }

  close(): void {
    this.readyState = 2
  }

  // Helper: simulate a generic 'message' event (for fallback handler)
  simulateMessage(data: string): void {
    const event = new MessageEvent('message', { data })
    this.onmessage?.(event)
    const listeners = this.listeners.get('message') || []
    listeners.forEach((listener) => listener(event))
  }

  // Helper: simulate a named SSE event (e.g. 'request:approved')
  // This matches the server format: `event: request:approved\ndata: {...}\n\n`
  simulateEvent(type: string, data: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(data) })
    if (type === 'message') {
      this.onmessage?.(event)
    }
    const listeners = this.listeners.get(type) || []
    listeners.forEach((listener) => listener(event))
  }
}

Object.defineProperty(global, 'EventSource', {
  value: MockEventSource,
  writable: true,
  configurable: true,
})
