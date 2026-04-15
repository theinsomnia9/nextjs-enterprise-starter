# Test-Driven Development Guide

This project follows strict TDD principles with a target of 80%+ code coverage across all modules.

## TDD Workflow

### 1. Red - Write Failing Tests First

Before implementing any feature, write tests that define the expected behavior:

```typescript
// __tests__/unit/lib/example.test.ts
import { describe, it, expect } from 'vitest'
import { myNewFunction } from '@/lib/example'

describe('myNewFunction', () => {
  it('should return correct value', () => {
    const result = myNewFunction('input')
    expect(result).toBe('expected output')
  })
})
```

Run the test - it should fail:
```bash
npm test
```

### 2. Green - Implement Minimum Code

Write just enough code to make the test pass:

```typescript
// src/lib/example.ts
export function myNewFunction(input: string): string {
  return 'expected output'
}
```

Run tests again - they should now pass:
```bash
npm test
```

### 3. Refactor - Improve Code Quality

Now improve the code while keeping tests green:

```typescript
// src/lib/example.ts
export function myNewFunction(input: string): string {
  // Add proper implementation
  return input.toUpperCase()
}

// Update test to match real behavior
```

### 4. Verify - Check Coverage

Ensure coverage targets are met:

```bash
npm run test:coverage
```

Coverage thresholds:
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

## Test Types

### Unit Tests

Test individual functions and modules in isolation.

**Location:** `__tests__/unit/`

**Example:**
```typescript
// __tests__/unit/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden')).toBe('base')
  })
})
```

Run unit tests:
```bash
npm run test:unit
```

### Integration Tests

Test interaction between multiple modules, including API routes and database operations.

**Location:** `__tests__/integration/`

**Example:**
```typescript
// __tests__/integration/api/chat.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/chat/route'
import { prisma } from '@/lib/prisma'

describe('POST /api/chat', () => {
  beforeEach(async () => {
    // Setup test data
  })

  afterEach(async () => {
    // Cleanup
    await prisma.message.deleteMany()
  })

  it('creates a new message', async () => {
    const req = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello', chatId: '123' })
    })

    const response = await POST(req)
    expect(response.status).toBe(201)
  })
})
```

Run integration tests:
```bash
npm run test:integration
```

### E2E Tests

Test complete user workflows in a real browser environment.

**Location:** `__tests__/e2e/`

**Example:**
```typescript
// __tests__/e2e/chat.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Chat Feature', () => {
  test('user can send and receive messages', async ({ page }) => {
    await page.goto('/chat')
    
    // Login
    await page.click('text=Login')
    
    // Send message
    await page.fill('[data-testid="message-input"]', 'Hello World')
    await page.click('[data-testid="send-button"]')
    
    // Verify message appears
    await expect(page.locator('text=Hello World')).toBeVisible()
  })
})
```

Run E2E tests:
```bash
npm run test:e2e
```

## API Mocking with MSW

Use Mock Service Worker to intercept and mock API calls.

### Setup MSW Handlers

```typescript
// __tests__/mocks/handlers/auth.ts
import { http, HttpResponse } from 'msw'

export const authHandlers = [
  http.get('/api/auth/session', () => {
    return HttpResponse.json({
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User'
      }
    })
  }),
]
```

### Use in Tests

```typescript
// __tests__/unit/components/UserProfile.test.ts
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import UserProfile from '@/components/UserProfile'
import { server } from '../mocks/server'
import { authHandlers } from '../mocks/handlers/auth'

describe('UserProfile', () => {
  it('displays user information', async () => {
    server.use(...authHandlers)
    
    render(<UserProfile />)
    
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
  })
})
```

## Testing Best Practices

### 1. Test Behavior, Not Implementation

❌ Bad:
```typescript
it('calls setState with new value', () => {
  expect(mockSetState).toHaveBeenCalledWith('new value')
})
```

✅ Good:
```typescript
it('displays new value when button is clicked', () => {
  fireEvent.click(button)
  expect(screen.getByText('new value')).toBeVisible()
})
```

### 2. Use Descriptive Test Names

❌ Bad:
```typescript
it('works', () => { ... })
```

✅ Good:
```typescript
it('displays error message when form validation fails', () => { ... })
```

### 3. Follow AAA Pattern

- **Arrange:** Set up test data and conditions
- **Act:** Execute the function/component
- **Assert:** Verify the expected outcome

```typescript
it('calculates total price correctly', () => {
  // Arrange
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 }
  ]
  
  // Act
  const total = calculateTotal(items)
  
  // Assert
  expect(total).toBe(35)
})
```

### 4. Keep Tests Independent

Each test should be able to run in isolation:

```typescript
describe('User management', () => {
  beforeEach(() => {
    // Fresh setup for each test
    resetDatabase()
  })

  it('creates user', () => { ... })
  it('updates user', () => { ... })
  it('deletes user', () => { ... })
})
```

### 5. Test Edge Cases

```typescript
describe('divide', () => {
  it('divides positive numbers', () => {
    expect(divide(10, 2)).toBe(5)
  })

  it('handles division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero')
  })

  it('handles negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5)
  })

  it('handles decimals', () => {
    expect(divide(5, 2)).toBe(2.5)
  })
})
```

## Testing React Components

### Component Rendering

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Button from '@/components/ui/button'

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Button</Button>)
    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })
})
```

### User Interactions

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('calls onClick when button is clicked', async () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click</Button>)
  
  await userEvent.click(screen.getByRole('button'))
  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

### Async Operations

```typescript
import { render, screen, waitFor } from '@testing-library/react'

it('loads and displays data', async () => {
  render(<DataComponent />)
  
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument()
  })
})
```

## Database Testing

### Use Test Database

Configure separate test database in `.env.test`:
```
TEST_DATABASE_URL="postgresql://user:password@localhost:5433/nextjs_boilerplate_test"
```

### Setup and Teardown

```typescript
import { beforeEach, afterEach, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

beforeEach(async () => {
  // Clean database before each test
  await prisma.message.deleteMany()
  await prisma.chat.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

## Coverage Reports

### View Coverage

```bash
npm run test:coverage
```

This generates:
- Terminal output with coverage summary
- HTML report in `coverage/index.html`
- LCOV report for CI tools

### Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

### Viewing HTML Report

Open `coverage/index.html` in a browser to see:
- File-by-file coverage breakdown
- Uncovered lines highlighted
- Branch coverage details

## Continuous Integration

### Pre-commit Checks

Run tests before committing:
```bash
npm test
npm run lint
npm run format:check
```

### CI Pipeline

Tests should run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled intervals

Example GitHub Actions workflow:
```yaml
- name: Run Tests
  run: |
    npm run test:coverage
    npm run test:e2e
```

## Tips for Maintaining High Coverage

1. **Write tests alongside code** - Don't leave testing for later
2. **Test public APIs** - Focus on exported functions and components
3. **Mock external dependencies** - Isolate code under test
4. **Use coverage reports** - Identify untested code paths
5. **Review PR coverage** - Ensure new code maintains coverage threshold
6. **Test error paths** - Don't just test happy paths
7. **Keep tests fast** - Use mocks to avoid slow operations

## Common Patterns

### Testing API Routes

```typescript
import { GET } from '@/app/api/users/route'

it('returns user list', async () => {
  const req = new Request('http://localhost/api/users')
  const response = await GET(req)
  const data = await response.json()
  
  expect(response.status).toBe(200)
  expect(data).toHaveLength(2)
})
```

### Testing Server Actions

```typescript
import { createWorkflow } from '@/app/actions/workflow'

it('creates workflow successfully', async () => {
  const result = await createWorkflow({
    name: 'Test Workflow',
    definition: { nodes: [], edges: [] }
  })
  
  expect(result.success).toBe(true)
  expect(result.workflowId).toBeDefined()
})
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCounter } from '@/hooks/useCounter'

it('increments counter', () => {
  const { result } = renderHook(() => useCounter())
  
  act(() => {
    result.current.increment()
  })
  
  expect(result.current.count).toBe(1)
})
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [Testing Best Practices](https://testingjavascript.com/)
