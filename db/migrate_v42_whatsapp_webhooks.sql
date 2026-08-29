-- migrate_v42_whatsapp_webhooks.sql
-- Meta WhatsApp Cloud: provider message IDs, inbound direction, phone index for matching.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'communication_logs'
  ) THEN
    ALTER TABLE communication_logs
      ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
      ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound',
      ADD COLUMN IF NOT EXISTS recipient_phone_e164 TEXT;

    -- Idempotent indexes
    CREATE INDEX IF NOT EXISTS idx_comm_logs_provider_msg
      ON communication_logs (provider_message_id)
      WHERE provider_message_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_comm_logs_tenant_phone
      ON communication_logs (tenant_id, recipient_phone_e164)
      WHERE recipient_phone_e164 IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_comm_logs_tenant_channel_created
      ON communication_logs (tenant_id, channel, created_at DESC);
  END IF;
END $$;

-- Fast lookup: Meta phone_number_id → tenant WhatsApp integration
CREATE INDEX IF NOT EXISTS idx_integrations_whatsapp_phone_number_id
  ON integrations ((config->>'phone_number_id'))
  WHERE slug IN ('whatsapp', 'whatsapp_twilio_legacy');

COMMENT ON COLUMN communication_logs.provider_message_id IS 'Meta wamid / Twilio SID for delivery status webhooks';
COMMENT ON COLUMN communication_logs.direction IS 'outbound | inbound';
