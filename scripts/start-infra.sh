#!/bin/bash

# Script to start infrastructure for local development
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../infra/docker-compose.yml"

# shellcheck source=lib/compose-detect.sh
. "$SCRIPT_DIR/lib/compose-detect.sh"

echo "🚀 Starting infrastructure..."

# Wait up to 10 seconds for a container engine (Docker or Podman) to be ready
MAX_RETRIES=10
RETRY_COUNT=0
until detect_compose; do
  if [ $RETRY_COUNT -eq 0 ]; then
    echo "⏳ Waiting for container engine (Docker or Podman) to start..."
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ No running container engine found."
    echo "   - Docker / OrbStack: start the engine (macOS: open -a OrbStack)"
    echo "   - Podman:            podman machine start"
    echo "   Override detection by setting COMPOSE, e.g.: COMPOSE='docker compose' $0"
    exit 1
  fi

  sleep 1
done

if [ $RETRY_COUNT -gt 0 ]; then
  echo "✅ Container engine is running"
fi

echo "🧰 Using compose command: $COMPOSE"

# Start infrastructure services
echo "📦 Starting PostgreSQL, OTEL Collector, Jaeger, Prometheus, Grafana, and y-websocket..."
$COMPOSE -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo "✅ Checking service health..."
$COMPOSE -f "$COMPOSE_FILE" ps

echo ""
echo "✅ Infrastructure started successfully!"
echo ""
echo "📊 Services available at:"
echo "   - PostgreSQL (dev):    localhost:5432"
echo "   - PostgreSQL (test):   localhost:5433"
echo "   - Jaeger UI:           http://localhost:16686"
echo "   - Prometheus:          http://localhost:9090"
echo "   - Grafana:             http://localhost:3001 (admin/admin)"
echo "   - OTEL Collector:      http://localhost:4318"
echo "   - y-websocket:         ws://localhost:1234"
echo ""
