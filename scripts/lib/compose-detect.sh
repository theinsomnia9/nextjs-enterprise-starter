# shellcheck shell=bash
# Sets $COMPOSE to the compose command available on this machine.
# Respects a pre-set $COMPOSE env var (e.g. COMPOSE="docker compose").
# Returns 0 if a compose command is found, 1 otherwise.

detect_compose() {
  if [ -n "${COMPOSE:-}" ]; then
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      COMPOSE="docker compose"
      return 0
    fi
    if command -v docker-compose >/dev/null 2>&1; then
      COMPOSE="docker-compose"
      return 0
    fi
  fi

  if command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
    if podman compose version >/dev/null 2>&1; then
      COMPOSE="podman compose"
      return 0
    fi
    if command -v podman-compose >/dev/null 2>&1; then
      COMPOSE="podman-compose"
      return 0
    fi
  fi

  return 1
}
