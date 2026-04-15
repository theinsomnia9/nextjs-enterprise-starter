# Infrastructure Setup Guide

## Quick Start

### 1. Start Infrastructure
```bash
./scripts/start-infra.sh
```

This will start all required services:
- PostgreSQL (development & test databases)
- Jaeger (distributed tracing)
- Prometheus (metrics)
- Grafana (visualization)
- OpenTelemetry Collector

### 2. Run Database Migrations
```bash
npm run db:migrate
```

### 3. Start the Application
```bash
npm run dev
```

## Services & Ports

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| Next.js App | 3000 | http://localhost:3000 | - |
| PostgreSQL (Dev) | 5432 | localhost:5432 | user/password |
| PostgreSQL (Test) | 5433 | localhost:5433 | user/password |
| Jaeger UI | 16686 | http://localhost:16686 | - |
| Prometheus | 9090 | http://localhost:9090 | - |
| Grafana | 3001 | http://localhost:3001 | admin/admin |
| OTEL Collector (HTTP) | 4318 | http://localhost:4318 | - |
| OTEL Collector (gRPC) | 4317 | localhost:4317 | - |

## VS Code Integration

### Launch Configurations

The project includes pre-configured debug configurations in `.vscode/launch.json`:

- **Next.js: Debug Server** - Automatically starts infrastructure, runs migrations, and starts the dev server
- **Next.js: Debug Full Stack** - Same as above with integrated terminal
- **Playwright: Debug All E2E Tests** - Runs E2E tests with infrastructure pre-launch

### Tasks

Available tasks in VS Code (Ctrl+Shift+P → "Tasks: Run Task"):

- **Start Infrastructure** - Start all Docker containers
- **Stop Infrastructure** - Stop all Docker containers
- **Check Infrastructure** - View status of all containers
- **Run Database Migrations** - Apply Prisma migrations
- **Setup: Start Infrastructure & Migrate DB** - Complete setup in one command

## Manual Commands

### Start Infrastructure
```bash
cd infra
docker-compose up -d
```

### Stop Infrastructure
```bash
./scripts/stop-infra.sh
# or
cd infra
docker-compose down
```

### Check Container Status
```bash
docker ps
# or
cd infra
docker-compose ps
```

### View Logs
```bash
cd infra
docker-compose logs -f [service-name]
```

Available service names: `postgres`, `postgres_test`, `jaeger`, `prometheus`, `grafana`, `otel-collector`

## Database Commands

### Run Migrations
```bash
npm run db:migrate
```

### Create New Migration
```bash
npm run db:migrate:create
```

### Reset Database (CAUTION: Deletes all data)
```bash
npm run db:reset
```

### Open Prisma Studio
```bash
npm run db:studio
```

## OpenTelemetry

The application is instrumented with OpenTelemetry for observability:

### Viewing Traces
1. Open Jaeger UI: http://localhost:16686
2. Select service: `nextjs-boilerplate`
3. Click "Find Traces"

### Viewing Metrics
1. Open Prometheus: http://localhost:9090
2. Query metrics like `http_server_duration_bucket`

### Dashboards
1. Open Grafana: http://localhost:3001
2. Login with `admin`/`admin`
3. Navigate to pre-configured dashboards

## Troubleshooting

### Docker Not Running
```bash
# Start OrbStack
open -a OrbStack

# Or use orbctl
orbctl start
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change Next.js port
PORT=3002 npm run dev
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check logs
cd infra
docker-compose logs postgres
```

### Clear Docker Volumes (CAUTION: Deletes all data)
```bash
cd infra
docker-compose down -v
docker-compose up -d
npm run db:migrate
```

## Development Workflow

1. **Start your day:**
   ```bash
   ./scripts/start-infra.sh
   npm run dev
   ```

2. **During development:**
   - Use VS Code debugger with "Next.js: Debug Full Stack"
   - View traces in Jaeger for API debugging
   - Monitor metrics in Prometheus/Grafana

3. **Before committing:**
   ```bash
   npm run test
   npm run lint
   npm run format
   ```

4. **End of day:**
   ```bash
   ./scripts/stop-infra.sh
   ```

## Environment Variables

Required environment variables in `.env`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/nextjs_boilerplate?schema=public"
TEST_DATABASE_URL="postgresql://user:password@localhost:5433/nextjs_boilerplate_test?schema=public"

# OpenTelemetry
OTEL_SERVICE_NAME="nextjs-boilerplate"
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"

# OpenAI (for chat feature)
OPENAI_API_KEY="your-api-key-here"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

## Architecture

```
┌─────────────────┐
│   Next.js App   │
│   Port: 3000    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌──────────────┐
│ DB   │  │ OTEL         │
│ 5432 │  │ Collector    │
└──────┘  └──────┬───────┘
               │
          ┌────┴─────┐
          │          │
          ▼          ▼
     ┌────────┐  ┌──────────┐
     │ Jaeger │  │Prometheus│
     │  16686 │  │   9090   │
     └────────┘  └─────┬────┘
                       │
                       ▼
                  ┌─────────┐
                  │ Grafana │
                  │  3001   │
                  └─────────┘
```

## Health Checks

All containers include health checks. Wait for services to be healthy before using:

```bash
cd infra
docker-compose ps
```

Look for `(healthy)` status before starting the application.
