#!/bin/bash
# Скрипт для компіляції та запуску Java коду через nsjail
# Використовується для безпечного виконання Java коду

set -euo pipefail

# Шляхи
NSJAIL_BIN="/usr/bin/nsjail"
CONFIG_FILE="/sandbox/profiles/nsjail_java.cfg"
JAVA_CODE_FILE="${1:-/dev/stdin}"
CLASS_DIR="/tmp"
CLASS_NAME="Main"

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

# Компіляція Java коду (поза sandbox, але з обмеженнями)
if ! javac -d "$CLASS_DIR" -encoding UTF-8 "$JAVA_CODE_FILE" 2>&1; then
  echo "ERROR: Compilation failed" >&2
  exit 1
fi

# Перевірка наявності скомпільованого класу
if [ ! -f "$CLASS_DIR/$CLASS_NAME.class" ]; then
  echo "ERROR: Compiled class not found" >&2
  exit 1
fi

# Запуск через nsjail
exec "$NSJAIL_BIN" \
  --config "$CONFIG_FILE" \
  --chroot "/sandbox/java" \
  --bindmount "$CLASS_DIR:/app" \
  --exec_bin "/usr/bin/java" \
  --arg "-Xmx200m" \
  --arg "-Xss1m" \
  --arg "-XX:+UseSerialGC" \
  --arg "-Djava.security.manager" \
  --arg "-Djava.security.policy=/dev/null" \
  --arg "-cp" \
  --arg "/app" \
  --arg "Main"

