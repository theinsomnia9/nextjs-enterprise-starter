import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden')).toBe('base')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
  })

  it('merges tailwind classes properly', () => {
    expect(cn('px-2 py-1', 'px-3')).toBe('py-1 px-3')
  })
})
