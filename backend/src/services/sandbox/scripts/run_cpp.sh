#!/bin/bash
# Скрипт для компіляції та запуску C++ коду через nsjail
# Використовується для безпечного виконання C++ коду

set -euo pipefail

# Шляхи
NSJAIL_BIN="/usr/bin/nsjail"
CONFIG_FILE="/sandbox/profiles/nsjail_cpp.cfg"
CPP_CODE_FILE="${1:-/dev/stdin}"
OUTPUT_BINARY="/tmp/app"

# Перевірка наявності nsjail
if [ ! -f "$NSJAIL_BIN" ]; then
  echo "ERROR: nsjail not found at $NSJAIL_BIN" >&2
  exit 1
fi

# Компіляція C++ коду (поза sandbox, але з обмеженнями)
if ! g++ -std=c++17 -O2 -static -o "$OUTPUT_BINARY" "$CPP_CODE_FILE" 2>&1; then
  echo "ERROR: Compilation failed" >&2
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
  --exec_bin "$OUTPUT_BINARY"

