import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

describe('Avatar', () => {
  it('renders fallback text when no image provided', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByText('AB')).toBeDefined()
  })

  it('renders fallback while image would load', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/a.png" alt="" />
        <AvatarFallback>CD</AvatarFallback>
      </Avatar>
    )
    // Radix keeps fallback in the tree until the image finishes loading;
    // in jsdom the image never loads, so the fallback stays visible.
    expect(screen.getByText('CD')).toBeDefined()
  })
})
