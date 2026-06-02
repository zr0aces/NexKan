#!/bin/bash
set -e

DATA_DIR="${DATA_DIR:-./data/tasks}"
SCRATCHPAD_DIR="${SCRATCHPAD_DIR:-./data/scratchpad}"
NOTIFICATIONS_FILE="${NOTIFICATIONS_FILE:-./data/notifications-sent.json}"

mkdir -p "$DATA_DIR"
mkdir -p "$SCRATCHPAD_DIR"
mkdir -p "$(dirname "$NOTIFICATIONS_FILE")"

if [ ! -f "$NOTIFICATIONS_FILE" ]; then
  echo '{}' > "$NOTIFICATIONS_FILE"
  echo "Created $NOTIFICATIONS_FILE"
fi

echo "Data directories ready."
