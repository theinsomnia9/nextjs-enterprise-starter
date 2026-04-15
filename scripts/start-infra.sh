#!/bin/bash

# Script to start infrastructure for local development
set -e

echo "🚀 Starting infrastructure..."

# Check if Docker is running, wait up to 10 seconds
MAX_RETRIES=10
RETRY_COUNT=0
while ! docker info > /dev/null 2>&1; do
  if [ $RETRY_COUNT -eq 0 ]; then
    echo "⏳ Waiting for Docker to start..."
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Docker is not running. Please start Docker/OrbStack and try again."
    echo "   Run: open -a OrbStack"
    exit 1
  fi
  
  sleep 1
done

if [ $RETRY_COUNT -gt 0 ]; then
  echo "✅ Docker is running"
fi

# Navigate to infra directory
cd "$(dirname "$0")/../infra" || exit 1

# Start infrastructure services
echo "📦 Starting PostgreSQL, Jaeger, Prometheus, and Grafana..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo "✅ Checking service health..."
docker-compose ps

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
echo ""
