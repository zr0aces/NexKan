#!/usr/bin/env bash
# Smoke test for NexKan deployment
# Usage: ./scripts/smoke.sh [BASE_URL] [USER:PASS]
# e.g.:  ./scripts/smoke.sh http://localhost:8092 admin:password

set -euo pipefail

BASE_URL="${1:-http://localhost:${HOST_PORT:-8092}}"
CREDS="${2:-}"

echo "=== NexKan Deployment Smoke Test ==="
echo "Target URL: $BASE_URL"

# Helper for assertions
assert_status() {
  local expected="$1"
  local actual="$2"
  local description="$3"

  if [ "$actual" -eq "$expected" ]; then
    echo "  [PASS] $description (got HTTP $actual)"
  else
    echo "  [FAIL] $description (expected HTTP $expected, got HTTP $actual)" >&2
    exit 1
  fi
}

echo ""
echo "1. Edge Authentication Matrix"

# GET /api/tasks without credentials -> 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/tasks" || true)
assert_status 401 "$STATUS" "GET /api/tasks without credentials"

# POST /api/notifications/check without credentials & without secret -> 401 from backend
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/notifications/check" || true)
assert_status 401 "$STATUS" "POST /api/notifications/check without secret"

# POST /api/webhooks/telegram without credentials & without secret -> 401 from backend
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/webhooks/telegram" || true)
assert_status 401 "$STATUS" "POST /api/webhooks/telegram without secret"

# GET /healthz through nginx -> not 200 JSON (nginx does not proxy /healthz, returns 404 or 401)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/healthz" || true)
if [ "$STATUS" -ne 200 ]; then
  echo "  [PASS] GET /healthz is not exposed through nginx (got HTTP $STATUS)"
else
  echo "  [FAIL] GET /healthz should not be proxied through nginx" >&2
  exit 1
fi

if [ -n "$CREDS" ]; then
  echo ""
  echo "2. Authenticated CRUD Round Trip"

  # GET /api/tasks with credentials -> 200
  STATUS=$(curl -s -u "$CREDS" -o /dev/null -w "%{http_code}" "$BASE_URL/api/tasks")
  assert_status 200 "$STATUS" "GET /api/tasks with credentials"

  # Create task -> 201
  CREATE_RESP=$(curl -s -u "$CREDS" -X POST "$BASE_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -d '{"title":"Smoke Test Task","status":"todo","due_date":"2099-12-31"}')
  
  TASK_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*' | cut -d'"' -f4 || true)
  if [ -z "$TASK_ID" ]; then
    echo "  [FAIL] Failed to extract task ID from creation response: $CREATE_RESP" >&2
    exit 1
  fi
  echo "  [PASS] Created task with ID: $TASK_ID"

  # Move task -> 200
  MOVE_STATUS=$(curl -s -u "$CREDS" -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/api/tasks/$TASK_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"in-progress"}')
  assert_status 200 "$MOVE_STATUS" "Move task to in-progress"

  # Delete task -> 204
  DEL_STATUS=$(curl -s -u "$CREDS" -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/api/tasks/$TASK_ID" \
    -H "Content-Type: application/json")
  assert_status 204 "$DEL_STATUS" "DELETE task $TASK_ID"

  # Verify deletion -> 404
  VERIFY_STATUS=$(curl -s -u "$CREDS" -o /dev/null -w "%{http_code}" "$BASE_URL/api/tasks/$TASK_ID")
  assert_status 404 "$VERIFY_STATUS" "Verify deleted task returns 404"
fi

echo ""
echo "Smoke test passed successfully."
