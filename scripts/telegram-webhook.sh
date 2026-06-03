#!/bin/sh
# Scripts to manage Telegram Webhook integration for NexKan.
# Supports info, set, and delete operations.
set -e

# Load .env if it exists
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
  # Read .env line by line to support spaces and avoid errors
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    case "$line" in
      \#*|""|" ") continue ;;
    esac
    # Remove leading/trailing whitespaces and export
    eval "export $line" 2>/dev/null || true
  done < "$ROOT_DIR/.env"
fi

# Override/fallback environment variables
TOKEN="${TELEGRAM_BOT_TOKEN}"
URL="${TELEGRAM_WEBHOOK_URL}"
SECRET="${TELEGRAM_WEBHOOK_SECRET}"

usage() {
  echo "Usage: $0 [info|set|delete|set-commands] [options]"
  echo ""
  echo "Commands:"
  echo "  info          Show current webhook status on Telegram"
  echo "  set           Set webhook to the URL configured in .env or passed via --url"
  echo "  delete        Remove webhook registration from Telegram"
  echo "  set-commands  Register NexKan bot autocomplete commands list with Telegram"
  echo ""
  echo "Options (overrides .env values):"
  echo "  --token <token>   Telegram Bot Token (from @BotFather)"
  echo "  --url <url>       Webhook public URL"
  echo "  --secret <secret> Secret token to validate incoming requests"
  echo ""
  exit 1
}

COMMAND=""
while [ $# -gt 0 ]; do
  case "$1" in
    info|set|delete|set-commands)
      COMMAND="$1"
      shift
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --url)
      URL="$2"
      shift 2
      ;;
    --secret)
      SECRET="$2"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

if [ -z "$COMMAND" ]; then
  usage
fi

if [ -z "$TOKEN" ]; then
  echo "Error: Telegram Bot Token is not configured." >&2
  echo "Set TELEGRAM_BOT_TOKEN in .env or pass it with --token." >&2
  exit 1
fi

# Helper to format JSON if python3 is available
format_json() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -m json.tool
  else
    cat
  fi
}

case "$COMMAND" in
  info)
    echo "Retrieving webhook status from Telegram..."
    curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | format_json
    ;;
  set)
    if [ -z "$URL" ]; then
      echo "Error: Webhook URL is not configured." >&2
      echo "Set TELEGRAM_WEBHOOK_URL in .env or pass it with --url." >&2
      exit 1
    fi
    echo "Registering Telegram webhook..."
    echo "URL: $URL"
    if [ -n "$SECRET" ]; then
      echo "Secret: [CONFIGURED]"
      curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
        -d "url=${URL}" \
        -d "secret_token=${SECRET}" | format_json
    else
      echo "Secret: [NONE]"
      curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
        -d "url=${URL}" | format_json
    fi
    ;;
  delete)
    echo "Deleting Telegram webhook registration..."
    curl -s "https://api.telegram.org/bot${TOKEN}/deleteWebhook" | format_json
    ;;
  set-commands)
    echo "Registering bot commands on Telegram..."
    curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setMyCommands" \
      -H "Content-Type: application/json" \
      -d '{
        "commands": [
          {"command": "start", "description": "Welcome message and display the help menu"},
          {"command": "add", "description": "Create task — /add <title> [date]"},
          {"command": "tasks", "description": "List all active (non-done) tasks"},
          {"command": "today", "description": "List tasks due today"},
          {"command": "overdue", "description": "List overdue tasks"},
          {"command": "task", "description": "Task detail + actions — /task <id>"},
          {"command": "move", "description": "Move task — /move <id> <todo|in-progress|done>"},
          {"command": "note", "description": "Save a scratchpad note — /note <text>"},
          {"command": "notes", "description": "List all scratchpad notes"},
          {"command": "delnote", "description": "Delete a scratchpad note — /delnote <id>"},
          {"command": "help", "description": "Show command reference"}
        ]
      }' | format_json
    ;;
esac
