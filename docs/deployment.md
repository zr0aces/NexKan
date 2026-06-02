# Deployment Guide

Production deployment on a self-hosted server (Raspberry Pi or any Linux VPS).

---

## Prerequisites

- Linux server with Docker + Docker Compose installed
- `apache2-utils` installed on the host for user management (`apt install apache2-utils`)
- A domain pointed at your server (for HTTPS and Telegram webhook)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

---

## First-time setup

### 1. Clone the repo

```bash
git clone <repo-url> /opt/nexkan
cd /opt/nexkan
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Host port nginx binds to
HOST_PORT=8092

# Timezone (e.g. Europe/Berlin, Asia/Bangkok)
TZ=UTC

# Telegram bot (required for bot/notifications; leave blank to disable)
TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
TELEGRAM_CHAT_ID=987654321
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram

# Generate with: openssl rand -hex 32
TELEGRAM_WEBHOOK_SECRET=<64-char-hex>
CRON_SECRET=<64-char-hex>

# Optional — default is /app/data/scratchpad (matches the Docker volume mount)
# SCRATCHPAD_DIR=/app/data/scratchpad
```

### 3. Initialize data directories

```bash
mkdir -p data/tasks data/scratchpad
echo '{}' > data/notifications-sent.json
```

> **Note:** `data/notifications-sent.json` must exist as a **file** before running
> `docker compose up`, because Docker bind-mounts an existing path as-is. If the
> file is absent Docker creates it as a directory, which breaks the backend.

### 4. Create the first user

nginx uses HTTP Basic Auth backed by `data/.htpasswd`. Create it before starting the stack:

```bash
./scripts/add-user.sh admin
# Prompts for a password. Uses bcrypt hashing.
```

### 5. Build the frontend

```bash
cd frontend && npm install && npm run build && cd ..
```

### 6. Start the stack

```bash
docker compose up -d
```

nginx uses the official `nginx:alpine` image — no custom build needed. The config and `.htpasswd` are bind-mounted from the host.

Verify:

```bash
docker compose ps          # both containers should be Up
docker compose logs backend --tail=20
curl -u admin:<password> http://localhost:8092/api/tasks   # should return []
```

---

## Managing users

All user management operates on `data/.htpasswd` on the host. Changes take effect immediately after reloading nginx — no container restart needed.

### Add or update a user

```bash
./scripts/add-user.sh <username>
# Prompts for password, then prints the reload command.
docker compose exec nginx nginx -s reload
```

Re-running with the same username updates the password.

### Remove a user

```bash
./scripts/remove-user.sh <username>
docker compose exec nginx nginx -s reload
```

### List users

```bash
cut -d: -f1 data/.htpasswd
```

---

## HTTPS setup (Let's Encrypt + Caddy)

The simplest approach is a Caddy reverse proxy in front of nginx. Caddy handles TLS automatically.

Install Caddy on the host, then create `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:8092
}
```

```bash
systemctl enable --now caddy
```

Caddy provisions a Let's Encrypt cert automatically. Your site is now HTTPS.

---

## Daily notifications cron

The cron job runs on the host and calls the backend's notification endpoint.

```bash
# Create secret file (cron can't read .env)
mkdir -p /etc/nexkan
echo "your-cron-secret-here" > /etc/nexkan/cron-secret
chmod 600 /etc/nexkan/cron-secret
```

Create `/etc/cron.d/nexkan`:

```cron
# NexKan daily notifications at 8:00 AM
0 8 * * * root curl -s -X POST https://yourdomain.com/api/notifications/check \
  -H "X-Cron-Secret: $(cat /etc/nexkan/cron-secret)" \
  >> /var/log/nexkan-cron.log 2>&1
```

Test it manually:

```bash
curl -s -X POST https://yourdomain.com/api/notifications/check \
  -H "X-Cron-Secret: $(cat /etc/nexkan/cron-secret)"
# Expected: {"ok":true}
```

---

## Updates

```bash
cd /opt/nexkan
git pull

# Rebuild frontend if frontend/ changed
cd frontend && npm install && npm run build && cd ..

# Restart (nginx pulls official image, no rebuild needed)
docker compose up -d

# Verify
docker compose ps
curl -u admin:<password> http://localhost:8092/api/tasks
```

User credentials in `data/.htpasswd` persist across updates — no re-creation needed.

---

## Deploy from GHCR images (no local build)

Use the production example compose file if you publish both images to GHCR:

```bash
cp docker-compose.prod.example.yml docker-compose.prod.yml
```

Set these variables in your `.env` (or export in shell):

```bash
GHCR_OWNER=<github-org-or-user>
NEXKAN_TAG=v2026.6.1
HOST_PORT=8092
```

Authenticate to GHCR (required for private packages):

```bash
echo <github_token> | docker login ghcr.io -u <github_user> --password-stdin
```

Start with the GHCR-based compose file:

```bash
docker compose -f docker-compose.prod.yml up -d
```

This pulls both images:
- `ghcr.io/${GHCR_OWNER}/nexkan-backend:${NEXKAN_TAG}`
- `ghcr.io/${GHCR_OWNER}/nexkan-frontend:${NEXKAN_TAG}`

---

## Backup

The `data/` directory is the source of truth. Back up both task files and credentials.

```bash
# Daily rsync backup
rsync -av /opt/nexkan/data/ /backup/nexkan/data/

# Or simple git snapshot in the data directory
cd /opt/nexkan/data
git init
git add .
git commit -m "backup $(date +%Y-%m-%d)"
```

To restore: copy `data/tasks/*.md` and `data/.htpasswd` back in place. No restart needed for tasks (read on demand); reload nginx after restoring `.htpasswd`:

```bash
docker compose exec nginx nginx -s reload
```

---

## Monitoring / logs

```bash
# Live logs
docker compose logs -f

# Backend only
docker compose logs backend -f --tail=50

# Check backend is responding
curl -u admin:<password> http://localhost:8092/api/telegram/status
```

---

## Troubleshooting

**nginx fails to start — `.htpasswd` not found**

The `.htpasswd` file must exist before `docker compose up`. Create at least one user first:

```bash
./scripts/add-user.sh admin
docker compose up -d
```

**Telegram webhook not receiving updates**

Use the built-in Node.js management script (runs inside the container, reads env from Docker):

```bash
# Check current webhook status and last error
docker compose exec backend node dist/scripts/telegram-webhook.js info

# Register / re-register webhook with current TELEGRAM_WEBHOOK_URL + TELEGRAM_WEBHOOK_SECRET
docker compose exec backend node dist/scripts/telegram-webhook.js set

# Remove webhook registration entirely
docker compose exec backend node dist/scripts/telegram-webhook.js delete
```

Or use the host shell helper (reads `.env` directly):

```bash
./scripts/telegram-webhook.sh info
./scripts/telegram-webhook.sh set
./scripts/telegram-webhook.sh delete
```

**401 Unauthorized from Telegram** (`last_error_message: Wrong response from the webhook: 401 Unauthorized`)

This means the secret Telegram sends doesn't match what the backend expects. Caused by:
- `TELEGRAM_WEBHOOK_SECRET` changed after the webhook was last registered, or
- Webhook was registered while `TELEGRAM_WEBHOOK_SECRET` was unset (no secret), then the env var was later added

Fix: re-register with the current secret:

```bash
docker compose exec backend node dist/scripts/telegram-webhook.js set
```

> **Note:** `TELEGRAM_WEBHOOK_SECRET` must use only `A–Z a–z 0–9 _ -` characters (Telegram API requirement). A hex string from `openssl rand -hex 32` is always valid.

Manual curl fallback:

```bash
# Check current registration
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Re-register
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://yourdomain.com/api/webhooks/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

**Notifications not sending**

```bash
# Test the endpoint manually
curl -s -X POST http://localhost:8092/api/notifications/check \
  -H "X-Cron-Secret: <CRON_SECRET>"

# Check TELEGRAM_CHAT_ID is set
grep TELEGRAM_CHAT_ID .env
```

**Tasks not persisting after restart**

Check that `./data/` is bind-mounted correctly:

```bash
docker compose exec backend ls /app/data/tasks
```

If empty, the volume mount failed — verify the `data/` directory exists on the host and `docker-compose.yml` paths are correct.

**Frontend shows "Failed to load tasks"**

```bash
docker compose ps
docker compose logs backend --tail=20
curl -u admin:<password> http://localhost:8092/api/tasks
```

---

## Docker image & architecture compatibility

To guarantee compatibility with diverse self-hosted environments (including various Raspberry Pi models and Linux VPS architectures), the backend uses `node:24-slim` as its base Docker image.

### Why `node:24-slim`?
- **Broad Architecture Support**: Debian-based slim images support `linux/amd64` (standard cloud servers), `linux/arm64` (64-bit Raspberry Pi OS), and `linux/arm/v7` (32-bit Raspberry Pi OS).
- **Alpine Incompatibility**: Official Node.js Alpine images (e.g., `node:24-alpine`) do not provide native support for `linux/arm/v7` and require modern host library support (like `libseccomp2`). Using Alpine-based images on older/32-bit Raspberry Pi OS versions frequently results in immediate container crashes ("exec format error" or time/network faults). The `slim` image uses `glibc` instead of `musl`, mitigating these issues.

### Building Multi-Platform Images
If you build and push Docker images to a registry (e.g. GitHub Packages or Docker Hub) from a development machine (like `x86_64`) rather than building locally on the target production machine, you must build multi-platform images so that the target pulls the correct architecture binary.

Use **Docker Buildx** to build and push a compatible multi-architecture backend image:

```bash
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t your-registry-user/nexkan-backend:latest --push ./backend
```

---

## Resource usage (Raspberry Pi 4)

Typical idle consumption:
- Backend: ~40 MB RAM
- nginx: ~5 MB RAM
- CPU: <1% idle, brief spikes on request

The stateless read-on-demand design means no background processes and no memory growth over time.
