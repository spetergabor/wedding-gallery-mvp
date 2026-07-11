#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${SPETLY_APP_DIR:-/opt/spetly}"
REPO_URL="${SPETLY_REPO_URL:-https://github.com/spetergabor/wedding-gallery-mvp.git}"
BRANCH="${SPETLY_BRANCH:-main}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root on the Hetzner server." >&2
  exit 1
fi

echo "Installing Docker, Git and base packages..."
apt-get update
apt-get install -y ca-certificates curl git docker.io docker-compose-plugin

systemctl enable --now docker

mkdir -p "$(dirname "$APP_DIR")"

if [[ -d "$APP_DIR/.git" ]]; then
  echo "Updating existing Spetly checkout in $APP_DIR..."
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  echo "Cloning Spetly into $APP_DIR..."
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env.zip-worker ]]; then
  cp .env.zip-worker.example .env.zip-worker
  chmod 600 .env.zip-worker
  echo "Created $APP_DIR/.env.zip-worker from the example file."
  echo "Edit it before starting the worker: nano $APP_DIR/.env.zip-worker"
else
  chmod 600 .env.zip-worker
fi

echo
echo "Bootstrap complete."
echo "Next steps:"
echo "  1. nano $APP_DIR/.env.zip-worker"
echo "  2. bash $APP_DIR/scripts/zip-worker-deploy.sh"
echo "  3. bash $APP_DIR/scripts/zip-worker-health.sh"
