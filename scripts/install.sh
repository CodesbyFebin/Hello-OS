#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/CodesbyFebin/Hello-OS.git"
INSTALL_DIR="${HELLO_OS_DIR:-$PWD/Hello-OS}"

if ! command -v git >/dev/null 2>&1; then
  printf '%s\n' "Git is required. Install Git, then rerun this script." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' "Docker Engine is required. Install Docker and Compose, then rerun this script." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  printf '%s\n' "Docker Compose plugin is required. Install it, then rerun this script." >&2
  exit 1
fi

if [ -e "$INSTALL_DIR" ]; then
  printf 'Install path already exists: %s\nSet HELLO_OS_DIR to a new path or remove the existing path yourself.\n' "$INSTALL_DIR" >&2
  exit 1
fi

git clone "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"
docker compose up --build -d
printf '\nHELLO OS is starting. Open http://localhost:3000\n'
printf 'Project directory: %s\n' "$INSTALL_DIR"
