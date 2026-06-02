/**
 * Telegram webhook management script.
 *
 * Usage (production):
 *   docker compose exec backend node dist/scripts/telegram-webhook.js info
 *   docker compose exec backend node dist/scripts/telegram-webhook.js set
 *   docker compose exec backend node dist/scripts/telegram-webhook.js delete
 *
 * Usage (dev):
 *   cd backend && npx ts-node -r tsconfig-paths/register src/scripts/telegram-webhook.ts info
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const command = process.argv[2];

if (!['set', 'delete', 'info'].includes(command)) {
  console.error('Usage: telegram-webhook.js <set|delete|info>');
  process.exit(1);
}

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

async function apiCall(method: string, body?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${API}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as { ok: boolean; result?: unknown; description?: string };
  if (!json.ok) throw new Error(json.description ?? `API error on ${method}`);
  return json.result;
}

async function info(): Promise<void> {
  const result = await apiCall('getWebhookInfo') as Record<string, unknown>;
  console.log('\nWebhook info:');
  console.log(`  url:                ${result.url || '(not set)'}`);
  console.log(`  has_custom_certificate: ${result.has_custom_certificate}`);
  console.log(`  pending_update_count:   ${result.pending_update_count}`);
  console.log(`  last_error_message: ${result.last_error_message || 'none'}`);
  console.log(`  last_error_date:    ${result.last_error_date ? new Date((result.last_error_date as number) * 1000).toISOString() : 'none'}`);
  console.log(`  max_connections:    ${result.max_connections}`);
  console.log(`  ip_address:         ${result.ip_address || '(unknown)'}`);
}

async function set(): Promise<void> {
  if (!WEBHOOK_URL) {
    console.error('TELEGRAM_WEBHOOK_URL is not set');
    process.exit(1);
  }

  const body: Record<string, unknown> = { url: WEBHOOK_URL };
  if (SECRET) {
    body.secret_token = SECRET;
    console.log(`  secret_token: set (${SECRET.length} chars)`);
  } else {
    console.warn('  TELEGRAM_WEBHOOK_SECRET not set — registering without secret (less secure)');
  }

  await apiCall('setWebhook', body);
  console.log(`\nWebhook set: ${WEBHOOK_URL}`);
  await info();
}

async function deleteWebhook(): Promise<void> {
  await apiCall('deleteWebhook', { drop_pending_updates: false });
  console.log('\nWebhook deleted. Bot will no longer receive updates until re-registered.');
}

(async () => {
  try {
    if (command === 'info') await info();
    else if (command === 'set') await set();
    else if (command === 'delete') await deleteWebhook();
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
