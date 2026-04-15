# Next.js Enterprise Boilerplate

A production-ready Next.js 14 application featuring comprehensive observability, authentication, real-time communication, and workflow management capabilities. Built with Test-Driven Development (TDD) principles and 80%+ code coverage.

## Features

- ✅ **Microsoft Entra ID Authentication** - Secure authentication with Azure AD integration
- ✅ **Full Observability Stack** - OpenTelemetry with Jaeger, Prometheus, and Grafana
- ✅ **Real-time Chat** - Server-Sent Events (SSE) based messaging system
- ✅ **Visual Workflow Builder** - Drag-and-drop workflow creation with ReactFlow
- ✅ **Workflow Execution Engine** - Track and visualize workflow progress
- ✅ **PostgreSQL Database** - Type-safe database operations with Prisma ORM
- ✅ **Comprehensive Testing** - Vitest (unit/integration), Playwright (E2E), MSW (mocking)
- ✅ **Modern UI** - Tailwind CSS with shadcn/ui components
- ✅ **Type Safety** - Full TypeScript implementation with strict mode
- ✅ **Docker Infrastructure** - Complete local development environment

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js v5 with Microsoft Entra ID
- **Observability:** OpenTelemetry (OTLP), Jaeger, Prometheus, Grafana
- **Real-time:** Server-Sent Events (SSE)
- **Workflows:** ReactFlow
- **Styling:** Tailwind CSS + shadcn/ui
- **Testing:** Vitest + Playwright + MSW
- **Containerization:** Docker + Docker Compose

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- PostgreSQL (or use Docker Compose setup)
- Microsoft Azure account (for Entra ID setup)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd nextjs-boiler-plate
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and configure:
- Database connection string
- Microsoft Entra ID credentials (see [AUTH_SETUP.md](./AUTH_SETUP.md))
- OpenTelemetry settings

### 3. Start Infrastructure

Start the complete observability stack with Docker Compose:

```bash
npm run infra:up
```

This starts:
- PostgreSQL (port 5432)
- PostgreSQL Test DB (port 5433)
- OpenTelemetry Collector (ports 4317, 4318)
- Jaeger UI (http://localhost:16686)
- Prometheus (http://localhost:9090)
- Grafana (http://localhost:3001) - admin/admin

### 4. Database Setup

Run Prisma migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing

### Run All Tests

```bash
npm test
```

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

### Coverage Report

```bash
npm run test:coverage
```

Coverage thresholds are set to 80% for lines, functions, branches, and statements.

## Observability

### View Traces

Open Jaeger UI at http://localhost:16686 to view distributed traces from your application.

### View Metrics

- **Prometheus:** http://localhost:9090 - Query and explore metrics
- **Grafana:** http://localhost:3001 - Pre-configured dashboards (admin/admin)

### Pre-built Dashboards

Grafana includes dashboards for:
- Next.js application metrics
- PostgreSQL database performance
- OpenTelemetry Collector metrics
- Workflow execution analytics

## Project Structure

```
nextjs-boiler-plate/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   ├── (auth)/             # Authentication pages
│   │   └── (protected)/        # Protected routes
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── chat/               # Chat components
│   │   └── workflow/           # Workflow components
│   ├── lib/                    # Utilities and helpers
│   │   ├── telemetry/          # OpenTelemetry setup
│   │   ├── auth.ts             # NextAuth configuration
│   │   └── prisma.ts           # Prisma client
│   └── types/                  # TypeScript types
├── prisma/                     # Database schema and migrations
├── __tests__/                  # Test files
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   ├── e2e/                    # E2E tests
│   └── mocks/                  # MSW handlers
├── infra/                      # Infrastructure configuration
│   ├── docker-compose.yml      # Complete stack
│   ├── otel-collector-config.yaml
│   ├── prometheus/
│   ├── grafana/
│   └── scripts/
└── docs/                       # Additional documentation
```

## Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [TDD Workflow Guide](./TDD.md)
- [OpenTelemetry Standards](./OPENTELEMETRY.md)
- [Authentication Setup](./AUTH_SETUP.md)
- [Workflow System](./WORKFLOW_GUIDE.md)
- [Infrastructure Setup](./infra/README.md)

## Development Workflow

### Following TDD Principles

1. **Write tests first** - Create failing tests for new features
2. **Implement** - Write minimal code to pass tests
3. **Refactor** - Improve code while maintaining test coverage
4. **Verify** - Run `npm run test:coverage` to ensure 80%+ coverage

See [TDD.md](./TDD.md) for detailed workflow.

### Adding New Features

1. Create test file in `__tests__/unit/` or `__tests__/integration/`
2. Write failing tests
3. Implement feature
4. Verify tests pass
5. Add E2E test if needed
6. Check coverage

## Production Deployment

### Build Application

```bash
npm run build
npm start
```

### Docker Production Build

```bash
docker build -t nextjs-boilerplate .
docker run -p 3000:3000 nextjs-boilerplate
```

### Environment Variables

Ensure all production environment variables are set:
- Database URL (production PostgreSQL)
- NextAuth configuration
- Entra ID credentials
- OpenTelemetry collector endpoint

## Common Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio
npm run infra:up         # Start infrastructure
npm run infra:down       # Stop infrastructure
npm run infra:logs       # View infrastructure logs
```

## Troubleshooting

### Database Connection Issues

Ensure PostgreSQL is running:
```bash
npm run infra:up
```

Check database logs:
```bash
docker logs nextjs-postgres
```

### OpenTelemetry Not Sending Data

1. Check collector is running: `docker ps | grep otel-collector`
2. View collector logs: `docker logs otel-collector`
3. Verify endpoint in `.env`: `OTEL_EXPORTER_OTLP_ENDPOINT`

### Tests Failing

1. Ensure test database is running
2. Run migrations on test database
3. Clear test cache: `npm run test -- --clearCache`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Implement your feature
5. Ensure tests pass and coverage is maintained
6. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
