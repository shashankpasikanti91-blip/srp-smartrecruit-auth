# WhatsApp Meta webhook (Phase B)

Callback URL for Meta Developer Console:

```text
https://<YOUR_PUBLIC_HOST>/api/webhooks/whatsapp
```

## Configure

1. **Integrations → WhatsApp Business (Meta)** — Save `access_token`, `phone_number_id`, `verify_token`, optional `app_secret` → **Test Connection**.
2. Meta App → WhatsApp → Configuration → Webhook:
   - Callback URL = above
   - Verify token = same as Integrations `verify_token` (or env `WHATSAPP_VERIFY_TOKEN`)
   - Subscribe: `messages`, `message_template_status_update` (optional)
3. Platform env (recommended for production signature check):
   - `META_APP_SECRET` or `WHATSAPP_APP_SECRET`
   - Optional: `WHATSAPP_VERIFY_TOKEN` (shared across tenants)

## Behaviour

| Event | Result |
|-------|--------|
| Delivery / read / failed | Updates `communication_logs.delivery_status` by Meta `wamid` (`provider_message_id`) |
| Inbound text | Inserts inbound log; matches Candidate by phone; Candidate timeline `comm_inbound` |

Tenant binding is **fail closed**: `metadata.phone_number_id` must match an `integrations` row (`slug=whatsapp`).

## Security

- Production requires App Secret HMAC (`X-Hub-Signature-256`).
- Without Meta credentials / public HTTPS → **REQUIRES EXTERNAL CONFIGURATION** — do not claim Connected inbox.

Apply DB: `migrate_v42_whatsapp_webhooks.sql` via `runMigrations`.
