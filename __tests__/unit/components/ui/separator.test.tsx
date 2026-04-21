import { describe, it, expect } from 'vitest'
import { render } from '../../../setup/test-utils'
import { Separator } from '@/components/ui/separator'

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(<Separator />)
    const el = container.querySelector('[role="none"], [data-orientation]')
    expect(el).toBeTruthy()
    expect(el?.getAttribute('data-orientation')).toBe('horizontal')
  })
})
