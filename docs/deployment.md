# Deployment Guide

Production deployment on a self-hosted server (Raspberry Pi or any Linux VPS).

---

## Prerequisites

- Linux server with Docker + Docker Compose installed
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
cp backend/.env.example .env
```

Edit `.env`:

```bash
# Required
TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
TELEGRAM_CHAT_ID=987654321
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram

# Generate these two with: openssl rand -hex 32
TELEGRAM_WEBHOOK_SECRET=<64-char-hex>
CRON_SECRET=<64-char-hex>

# Set to your local timezone
TZ=Europe/Berlin
```

### 3. Initialize data directories

```bash
mkdir -p data/tasks
echo '{}' > data/notifications-sent.json
```

### 4. Build the frontend

```bash
cd frontend && npm install && npm run build && cd ..
```

### 5. Create nginx credentials

```bash
# Replace 'yourpassword' with a strong password
docker run --rm httpd:alpine htpasswd -nb admin yourpassword > nginx/.htpasswd
```

### 6. Start the stack

```bash
docker compose up --build -d
```

Verify:

```bash
docker compose ps          # both containers should be Up
docker compose logs backend --tail=20
curl -u admin:yourpassword http://localhost/api/tasks   # should return []
```

---

## HTTPS setup (Let's Encrypt + Caddy)

The simplest approach is a Caddy reverse proxy in front of nginx. Caddy handles TLS automatically.

Install Caddy on the host, then create `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:80
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

# Restart services
docker compose up --build -d

# Verify
docker compose ps
curl -u admin:yourpassword http://localhost/api/tasks
```

---

## Backup

The `data/` directory is the source of truth. Everything else is reproducible from code.

```bash
# Daily rsync backup
rsync -av /opt/nexkan/data/ /backup/nexkan/data/

# Or simple git snapshot in the data directory
cd /opt/nexkan/data
git init
git add .
git commit -m "backup $(date +%Y-%m-%d)"
```

To restore: copy `data/tasks/*.md` back in place. The app reads from disk on every request — no restart needed.

---

## Monitoring / logs

```bash
# Live logs
docker compose logs -f

# Backend only
docker compose logs backend -f --tail=50

# Check backend is responding
curl -u admin:yourpassword http://localhost/api/telegram/status
```

---

## Troubleshooting

**Telegram webhook not receiving updates**

```bash
# Check webhook registration
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Re-register manually
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://yourdomain.com/api/webhooks/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

**Notifications not sending**

```bash
# Test the endpoint manually
curl -s -X POST http://localhost/api/notifications/check \
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

The frontend dev server is probably not running or the backend is down:

```bash
docker compose ps
docker compose logs backend --tail=20
```

For production, check nginx is proxying to backend:

```bash
curl -u admin:yourpassword http://localhost/api/tasks
```

---

## Resource usage (Raspberry Pi 4)

Typical idle consumption:
- Backend: ~40 MB RAM
- nginx: ~5 MB RAM
- CPU: <1% idle, brief spikes on request

The stateless read-on-demand design means no background processes and no memory growth over time.
