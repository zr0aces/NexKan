#!/bin/sh
# Add or update a NexKan basic-auth user in data/.htpasswd.
# Requires: htpasswd  (apt install apache2-utils  |  brew install httpd)
set -e

HTPASSWD_FILE="$(cd "$(dirname "$0")/.." && pwd)/data/.htpasswd"

if [ -z "$1" ]; then
  echo "Usage: $0 <username>" >&2
  exit 1
fi

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "Error: htpasswd not found." >&2
  echo "  Debian/Ubuntu : apt install apache2-utils" >&2
  echo "  macOS         : brew install httpd" >&2
  exit 1
fi

mkdir -p "$(dirname "$HTPASSWD_FILE")"

if [ -f "$HTPASSWD_FILE" ]; then
  htpasswd -B "$HTPASSWD_FILE" "$1"
else
  htpasswd -Bc "$HTPASSWD_FILE" "$1"
fi

echo ""
echo "Reload nginx to apply changes:"
echo "  docker compose exec nginx nginx -s reload"
