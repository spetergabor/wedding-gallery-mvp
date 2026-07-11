#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${SPETLY_APP_DIR:-$(pwd)}"
BRANCH="${SPETLY_BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -f .env.zip-worker ]]; then
  echo "Missing .env.zip-worker in $APP_DIR." >&2
  echo "Create it from .env.zip-worker.example before deploying." >&2
  exit 1
fi

echo "Updating source..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "Building and starting ZIP worker..."
docker compose -f docker-compose.zip-worker.yml up -d --build

echo
docker compose -f docker-compose.zip-worker.yml ps

echo
echo "ZIP worker deployed. Follow logs with:"
echo "  docker compose -f docker-compose.zip-worker.yml logs -f --tail=100"
