import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../../setup/test-utils'
import ThemeToggle from '@/components/theme/ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('should render the theme toggle button', () => {
    render(<ThemeToggle />)
    
    const button = screen.getByRole('button', { name: /toggle theme/i })
    expect(button).toBeDefined()
  })

  it('should toggle dark mode when clicked', () => {
    render(<ThemeToggle />)
    
    const button = screen.getByRole('button', { name: /toggle theme/i })
    
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    
    fireEvent.click(button)
    
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should toggle back to light mode on second click', () => {
    render(<ThemeToggle />)
    
    const button = screen.getByRole('button', { name: /toggle theme/i })
    
    fireEvent.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    
    fireEvent.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should save theme preference to localStorage', () => {
    render(<ThemeToggle />)
    
    const button = screen.getByRole('button', { name: /toggle theme/i })
    
    fireEvent.click(button)
    
    expect(localStorage.getItem('theme')).toBe('dark')
    
    fireEvent.click(button)
    
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('should load theme from localStorage on mount', () => {
    localStorage.setItem('theme', 'dark')
    
    render(<ThemeToggle />)
    
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should show correct icon for current theme', () => {
    const { container } = render(<ThemeToggle />)
    
    const button = screen.getByRole('button', { name: /toggle theme/i })
    
    const sunIcon = container.querySelector('[data-icon="sun"]')
    expect(sunIcon).toBeTruthy()
    
    fireEvent.click(button)
    
    const moonIcon = container.querySelector('[data-icon="moon"]')
    expect(moonIcon).toBeTruthy()
  })
})
