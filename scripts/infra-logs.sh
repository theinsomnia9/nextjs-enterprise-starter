#!/bin/bash

# Tail logs from the infrastructure stack
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../infra/docker-compose.yml"

# shellcheck source=lib/compose-detect.sh
. "$SCRIPT_DIR/lib/compose-detect.sh"

if ! detect_compose; then
  echo "❌ No running container engine found (Docker or Podman)."
  echo "   Override detection by setting COMPOSE, e.g.: COMPOSE='docker compose' $0"
  exit 1
fi

exec $COMPOSE -f "$COMPOSE_FILE" logs -f "$@"
