import { describe, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../../../setup/test-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

describe('DropdownMenu', () => {
  it('opens when the trigger is clicked and shows items', async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>One</DropdownMenuItem>
          <DropdownMenuItem>Two</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open'))

    expect(screen.getByText('One')).toBeDefined()
    expect(screen.getByText('Two')).toBeDefined()
  })
})
