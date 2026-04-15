#!/bin/bash

# Script to stop infrastructure
set -e

echo "🛑 Stopping infrastructure..."

cd "$(dirname "$0")/../infra" || exit 1

docker-compose down

echo "✅ Infrastructure stopped successfully!"
