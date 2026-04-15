# Infrastructure Setup

This directory contains all configuration for the local development infrastructure including observability stack.

## Services

### PostgreSQL (port 5432)
Primary application database

**Connection:**
```
postgresql://user:password@localhost:5432/nextjs_boilerplate
```

### PostgreSQL Test (port 5433)
Dedicated database for integration tests

**Connection:**
```
postgresql://user:password@localhost:5433/nextjs_boilerplate_test
```

### OpenTelemetry Collector (ports 4317, 4318, 8888, 8889)
Receives, processes, and exports telemetry data

**Endpoints:**
- `4317` - OTLP gRPC receiver
- `4318` - OTLP HTTP receiver
- `8888` - Collector metrics
- `8889` - Prometheus exporter

### Jaeger (port 16686)
Distributed tracing UI

**Access:** http://localhost:16686

**Features:**
- Search and filter traces
- View trace details and spans
- Service dependency graphs
- Performance analysis

### Prometheus (port 9090)
Metrics collection and storage

**Access:** http://localhost:9090

**Features:**
- PromQL query interface
- Metric exploration
- Alert rules (configure as needed)

### Grafana (port 3001)
Visualization and dashboards

**Access:** http://localhost:3001  
**Credentials:** admin / admin

**Dashboards:**
- Next.js Application Metrics
- PostgreSQL Performance
- OpenTelemetry Collector Stats
- Workflow Execution Analytics

## Quick Start

### Start All Services

```bash
cd /path/to/project
npm run infra:up
```

This starts all services in detached mode.

### Stop All Services

```bash
npm run infra:down
```

### View Logs

```bash
# All services
npm run infra:logs

# Specific service
docker logs -f otel-collector
docker logs -f postgres
docker logs -f jaeger
```

### Check Service Health

```bash
docker ps

# Should show all services as healthy after ~30 seconds
```

## Configuration Files

### docker-compose.yml
Main orchestration file defining all services, networks, and volumes

### otel-collector-config.yaml
OpenTelemetry Collector pipeline configuration
- Receivers: OTLP (gRPC + HTTP)
- Processors: Batch, Memory Limiter, Resource
- Exporters: Jaeger, Prometheus, Console

### prometheus/prometheus.yml
Prometheus scrape configuration
- Collector metrics
- Application metrics via OTEL exporter

### grafana/provisioning/
Auto-provisioned Grafana configuration
- `datasources/` - Prometheus datasource
- `dashboards/` - Dashboard provider config

### grafana/dashboards/
Pre-built Grafana dashboard JSON files

## Troubleshooting

### Services Won't Start

1. Check Docker is running:
   ```bash
   docker ps
   ```

2. Check port conflicts:
   ```bash
   lsof -i :5432
   lsof -i :3001
   ```

3. View service logs:
   ```bash
   docker-compose -f infra/docker-compose.yml logs
   ```

### Database Connection Failed

1. Ensure PostgreSQL is healthy:
   ```bash
   docker ps | grep postgres
   ```

2. Test connection:
   ```bash
   psql postgresql://user:password@localhost:5432/nextjs_boilerplate
   ```

### No Traces in Jaeger

1. Check collector is receiving data:
   ```bash
   docker logs otel-collector | grep -i "trace"
   ```

2. Verify app is sending to correct endpoint:
   ```bash
   echo $OTEL_EXPORTER_OTLP_ENDPOINT
   # Should be: http://localhost:4318
   ```

3. Check collector health:
   ```bash
   curl http://localhost:13133/
   ```

### Grafana Dashboards Not Loading

1. Check provisioning directory is mounted:
   ```bash
   docker exec grafana ls /etc/grafana/provisioning
   ```

2. Restart Grafana:
   ```bash
   docker restart grafana
   ```

## Customization

### Adding Grafana Dashboards

1. Create or export dashboard JSON
2. Place in `infra/grafana/dashboards/`
3. Restart Grafana:
   ```bash
   docker restart grafana
   ```

### Modifying Prometheus Scrape Config

1. Edit `infra/prometheus/prometheus.yml`
2. Reload Prometheus:
   ```bash
   docker exec prometheus kill -HUP 1
   ```

### Updating OTEL Collector Pipeline

1. Edit `infra/otel-collector-config.yaml`
2. Restart collector:
   ```bash
   docker restart otel-collector
   ```

## Data Persistence

Data is persisted in Docker volumes:
- `postgres_data` - Application database
- `postgres_test_data` - Test database
- `prometheus_data` - Metrics storage
- `grafana_data` - Dashboards and settings

### Backup Data

```bash
# Backup PostgreSQL
docker exec nextjs-postgres pg_dump -U user nextjs_boilerplate > backup.sql

# Backup Grafana dashboards
docker exec grafana tar czf - /var/lib/grafana > grafana-backup.tar.gz
```

### Reset Data

```bash
# WARNING: This deletes all data
docker-compose -f infra/docker-compose.yml down -v
npm run infra:up
```

## Production Considerations

This infrastructure is designed for local development. For production:

1. **Use managed services:**
   - Managed PostgreSQL (AWS RDS, Azure Database)
   - Hosted Prometheus (AWS AMP, Grafana Cloud)
   - Managed Jaeger or similar (AWS X-Ray, DataDog APM)

2. **Configure proper authentication:**
   - Database credentials from secrets
   - Grafana SSO integration
   - OTEL collector with authentication

3. **Set resource limits:**
   - Database connection pooling
   - OTEL collector memory limits
   - Prometheus retention policies

4. **Enable TLS:**
   - Database connections
   - OTEL endpoints
   - Grafana HTTPS

## Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
