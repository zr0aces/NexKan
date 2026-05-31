#!/bin/sh
set -e

if [ -z "$AUTH_USER" ] || [ -z "$AUTH_PASSWORD" ]; then
  echo "ERROR: AUTH_USER and AUTH_PASSWORD must be set in .env" >&2
  exit 1
fi

htpasswd -cb /etc/nginx/.htpasswd "$AUTH_USER" "$AUTH_PASSWORD"

exec nginx -g 'daemon off;'
