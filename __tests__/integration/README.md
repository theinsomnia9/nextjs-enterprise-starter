# Integration Tests

Integration tests hit the real test PostgreSQL database running on port 5433.

## Prerequisites

1. Start the Docker test database:
   ```bash
   npm run infra:up
   ```
2. Apply migrations to the test DB:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5433/nextjs_boilerplate_test?schema=public" npx prisma migrate deploy
   ```

## Running

```bash
# Run all integration tests
DATABASE_URL="postgresql://user:password@localhost:5433/nextjs_boilerplate_test?schema=public" npm run test:integration

# Run a specific file
DATABASE_URL="postgresql://user:password@localhost:5433/nextjs_boilerplate_test?schema=public" npm run test:integration -- __tests__/integration/actions/approvals.test.ts
```

## Environment

The test database URL is `TEST_DATABASE_URL` in `.env`. Pass it as `DATABASE_URL` when running integration tests so Prisma connects to the isolated test schema (port 5433) instead of the dev database (port 5432).

## Conventions

- Tests use `prisma` directly to seed and clean up data.
- Each test file cleans up its own records in `afterAll`.
- `beforeEach` deletes rows seeded by the test to ensure isolation between tests in the same file.
- Server Action mocks: `__tests__/helpers/mockActor.ts` mocks `getActor`/`getActorId`; `__tests__/helpers/broadcastSpy.ts` spies on `broadcastApprovalEvent`.
