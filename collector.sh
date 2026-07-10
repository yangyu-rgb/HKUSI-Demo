#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="${ROOT_DIR}/data/runtime"
PYTHON="${ROOT_DIR}/backend/.venv/bin/python"
SCRIPT="${ROOT_DIR}/backend/scripts/collect_official_sources.py"
PID_FILE="${RUNTIME_DIR}/official-collector.pid"
LOG_FILE="${RUNTIME_DIR}/official-collector.log"

mkdir -p "${RUNTIME_DIR}"

running_pid() {
  [[ -f "${PID_FILE}" ]] || return 1
  local pid
  pid="$(<"${PID_FILE}")"
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  kill -0 "${pid}" 2>/dev/null || return 1
  printf '%s' "${pid}"
}

start_collector() {
  if pid="$(running_pid)"; then
    printf 'Official collector is already running (PID %s).\n' "${pid}"
    return 0
  fi
  [[ -x "${PYTHON}" ]] || {
    printf 'Backend virtual environment is missing; run ./start.sh once first.\n' >&2
    return 1
  }
  nohup "${PYTHON}" -u "${SCRIPT}" --interval 60 >>"${LOG_FILE}" 2>&1 &
  pid=$!
  printf '%s\n' "${pid}" >"${PID_FILE}"
  sleep 1
  kill -0 "${pid}" 2>/dev/null || {
    rm -f "${PID_FILE}"
    printf 'Official collector failed to start; inspect %s.\n' "${LOG_FILE}" >&2
    return 1
  }
  printf 'Official collector started (PID %s). Log: %s\n' "${pid}" "${LOG_FILE}"
}

stop_collector() {
  if ! pid="$(running_pid)"; then
    printf 'Official collector is not running.\n'
    rm -f "${PID_FILE}"
    return 0
  fi
  kill "${pid}"
  wait "${pid}" 2>/dev/null || true
  rm -f "${PID_FILE}"
  printf 'Official collector stopped (PID %s).\n' "${pid}"
}

status_collector() {
  if pid="$(running_pid)"; then
    printf 'Process: running (PID %s)\n' "${pid}"
  else
    printf 'Process: stopped\n'
  fi
  [[ -x "${PYTHON}" ]] && "${PYTHON}" "${SCRIPT}" --status
}

case "${1:-status}" in
  start) start_collector ;;
  stop) stop_collector ;;
  restart) stop_collector; start_collector ;;
  status) status_collector ;;
  *) printf 'Usage: %s {start|stop|restart|status}\n' "$0" >&2; exit 2 ;;
esac
