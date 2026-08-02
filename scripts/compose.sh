#!/bin/sh
# Runs a compose command on whichever engine is installed. Podman first.
#
# Podman is the engine this project is deployed on, so it is the default rather
# than the fallback — a default that is only exercised on someone else's machine
# is a default that breaks quietly. Docker is fully supported and picked up
# automatically when Podman is absent; nothing in the compose files is specific
# to either.
#
# Override with COMPOSE_ENGINE=docker (or =podman) when both are installed and
# you want the other one.
#
# Usage: sh scripts/compose.sh up -d --build

set -e

has() { command -v "$1" >/dev/null 2>&1; }

# `podman compose` is a thin shim that hands off to whatever compose provider is
# installed. On older Podman it does not exist at all and `podman-compose` is a
# separate program, so both spellings are tried before giving up on Podman.
run_podman() {
  if podman compose version >/dev/null 2>&1; then
    exec podman compose "$@"
  elif has podman-compose; then
    exec podman-compose "$@"
  fi
  return 1
}

case "${COMPOSE_ENGINE:-}" in
  podman) run_podman "$@" || { echo "COMPOSE_ENGINE=podman, but no compose provider for it." >&2; exit 1; } ;;
  docker) exec docker compose "$@" ;;
  "") ;;
  *) echo "COMPOSE_ENGINE must be podman or docker, not '$COMPOSE_ENGINE'." >&2; exit 1 ;;
esac

if has podman && run_podman "$@"; then
  exit 0
fi

if has docker; then
  exec docker compose "$@"
fi

echo "No container engine found. Install Podman (preferred) or Docker." >&2
echo "Podman: https://podman.io/docs/installation" >&2
exit 1
