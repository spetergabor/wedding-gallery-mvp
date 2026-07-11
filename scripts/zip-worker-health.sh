#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${SPETLY_APP_DIR:-$(pwd)}"

cd "$APP_DIR"

docker compose -f docker-compose.zip-worker.yml ps

echo
echo "Running container entrypoint check..."
docker compose -f docker-compose.zip-worker.yml run --rm zip-worker npm run zip-worker -- --check

echo
echo "Recent logs:"
docker compose -f docker-compose.zip-worker.yml logs --tail=100 zip-worker
