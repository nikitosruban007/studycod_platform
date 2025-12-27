#!/bin/bash
# Скрипт для запуску Python коду через nsjail
# Використовується для безпечного виконання Python коду

set -euo pipefail

# Шляхи
NSJAIL_BIN="/usr/bin/nsjail"
CONFIG_FILE="/sandbox/profiles/nsjail_python.cfg"
PYTHON_CODE_FILE="${1:-/dev/stdin}"

# Перевірка наявності nsjail
if [ ! -f "$NSJAIL_BIN" ]; then
  echo "ERROR: nsjail not found at $NSJAIL_BIN" >&2
  exit 1
fi

# Перевірка наявності конфігурації
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Config file not found at $CONFIG_FILE" >&2
  exit 1
fi

# Запуск через nsjail
exec "$NSJAIL_BIN" \
  --config "$CONFIG_FILE" \
  -- < "$PYTHON_CODE_FILE"

