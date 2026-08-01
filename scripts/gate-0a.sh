#!/usr/bin/env bash
set -euo pipefail

gate_port="43117"
server_pid=""

cleanup() {
  if [[ -n "${server_pid}" ]] && kill -0 "${server_pid}" 2>/dev/null; then
    kill "${server_pid}" 2>/dev/null || true
    wait "${server_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ ! -f package-lock.json ]]; then
  echo "Gate 0A requires package-lock.json" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Gate 0A requires a clean tracked worktree" >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"${gate_port}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Gate 0A port ${gate_port} is occupied" >&2
  exit 1
fi

npm ci
npm run typecheck
npm run lint
npm test -- src/contracts
npm run build

PORT="${gate_port}" npm run start >/tmp/vibedoc-gate-0a.log 2>&1 &
server_pid="$!"

for _ in $(seq 1 30); do
  if curl --fail --silent "http://127.0.0.1:${gate_port}/health" >/dev/null; then
    exit 0
  fi
  sleep 1
done

echo "Gate 0A health check timed out" >&2
exit 1
