# Infrastructure

Docker Compose stack for local Postgres + full observability (OTEL Collector → Jaeger + Prometheus + Grafana). Start from the repo root with `npm run infra:up`; stop with `npm run infra:down`.

## Services & ports

| Service | URL / Port | Purpose | Credentials |
|---|---|---|---|
| PostgreSQL (dev) | `localhost:5432` | Application DB | `user` / `password` |
| PostgreSQL (test) | `localhost:5433` | Integration-test DB | `user` / `password` |
| OTEL Collector | `4317` gRPC · `4318` HTTP · `8888`, `8889` metrics | Receives traces/metrics from the app | — |
| Jaeger | http://localhost:16686 | Trace search & timeline | — |
| Prometheus | http://localhost:9090 | Metrics + PromQL | — |
| Grafana | http://localhost:3001 | Dashboards | `admin` / `admin` |

Wait for `docker ps` to show all containers as `(healthy)` before starting the app.

## Files

```
infra/
├── docker-compose.yml              # All services
├── otel-collector-config.yaml      # Receivers → processors → exporters
├── prometheus/prometheus.yml       # Scrape config
├── grafana/
│   ├── provisioning/datasources/   # Prometheus datasource
│   └── dashboards/                 # Pre-built dashboard JSON
└── scripts/                        # init-db.sh, wait-for-it.sh
```

## Common operations

```bash
npm run infra:up                   # Start all services
npm run infra:down                 # Stop all services
npm run infra:logs                 # Tail all logs
docker logs -f otel-collector      # Tail a single service
docker-compose -f infra/docker-compose.yml ps   # Health status
docker-compose -f infra/docker-compose.yml down -v   # Reset all data (destructive)
```

## VS Code integration

`.vscode/launch.json` has launch configs that call `npm run infra:up` as a pre-launch task — pick **Next.js: Debug Server** or **Playwright: Debug All E2E Tests** from the Run & Debug panel. Tasks (`Ctrl+Shift+P` → *Tasks: Run Task*) mirror the npm scripts.

## Troubleshooting

**No traces in Jaeger.** Check the collector is receiving: `docker logs otel-collector | grep -i trace`. Verify `OTEL_EXPORTER_OTLP_ENDPOINT` in `.env` points at `http://localhost:4318`. Collector health: `curl http://localhost:13133/`.

**Port conflict on startup.** `lsof -i :5432` (or the offending port) to find the squatter. Change the published port in `docker-compose.yml` or kill the process.

**Grafana dashboards missing.** `docker exec grafana ls /etc/grafana/provisioning` should list `datasources/` and `dashboards/`. If not, the volume mount is broken — `docker restart grafana` after fixing `docker-compose.yml`.

**Clean slate.** `docker-compose -f infra/docker-compose.yml down -v` drops all volumes (`postgres_data`, `postgres_test_data`, `prometheus_data`, `grafana_data`). Re-run migrations afterwards.

## Production

This stack is dev-only. For production, use managed equivalents: Azure Database for PostgreSQL / AWS RDS, Grafana Cloud or Azure Managed Prometheus, and either a managed APM (DataDog, New Relic) or a hardened self-hosted Jaeger. See `docs/azure-production-setup.md` for the current target deployment path.
