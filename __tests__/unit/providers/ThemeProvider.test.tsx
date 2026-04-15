import { describe, it, expect, beforeEach } from 'vitest'
import { useContext, createContext } from 'react'
import { render, screen, fireEvent, renderHook, waitFor } from '../../setup/test-utils'
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider'

// A consumer that gracefully handles the unmounted phase
function SafeThemeConsumer({ testId = 'theme-value' }: { testId?: string }) {
  try {
    const { theme, toggleTheme, setTheme } = useTheme()
    return (
      <div>
        <span data-testid={testId}>{theme}</span>
        <button onClick={toggleTheme}>Toggle</button>
        <button onClick={() => setTheme('dark')}>Set Dark</button>
        <button onClick={() => setTheme('light')}>Set Light</button>
      </div>
    )
  } catch {
    return <div data-testid="unmounted">Loading</div>
  }
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('should render children', () => {
    render(
      <ThemeProvider>
        <div>Test Child</div>
      </ThemeProvider>
    )

    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })

  it('should render children without context before mount', () => {
    render(
      <ThemeProvider>
        <SafeThemeConsumer />
      </ThemeProvider>
    )

    // After mount effect fires, context should be available
    expect(screen.getByTestId('theme-value')).toBeInTheDocument()
  })

  it('should toggle theme when toggleTheme is called', async () => {
    render(
      <ThemeProvider>
        <SafeThemeConsumer />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toBeInTheDocument()
    })

    const toggleButton = screen.getByRole('button', { name: /^Toggle$/i })
    fireEvent.click(toggleButton)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('should set theme explicitly via setTheme', async () => {
    render(
      <ThemeProvider>
        <SafeThemeConsumer />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Set Dark/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Set Light/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should load saved theme from localStorage on mount', async () => {
    localStorage.setItem('theme', 'dark')

    render(
      <ThemeProvider>
        <SafeThemeConsumer />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toBeInTheDocument()
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

describe('useTheme', () => {
  it('should throw error when used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useTheme())
    }).toThrow('useTheme must be used within a ThemeProvider')
  })
})
