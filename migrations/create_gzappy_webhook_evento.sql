-- Migration: Criar tabela de auditoria para eventos de webhook da Gzappy
-- Data: 2026-04-26
-- Descrição: Armazena payloads brutos e metadados extraídos dos eventos recebidos

CREATE TABLE IF NOT EXISTS "GzappyWebhookEvento" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "publicInstanceId" TEXT,
  "eventType" TEXT NOT NULL,
  "messageId" TEXT,
  "direction" TEXT,
  phone TEXT,
  "messageText" TEXT,
  payload JSONB NOT NULL,
  headers JSONB,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEBIDO',
  "processedAt" TIMESTAMPTZ,
  "processingNotes" TEXT
);

CREATE INDEX IF NOT EXISTS idx_gzappy_webhook_evento_received_at
  ON "GzappyWebhookEvento"("receivedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_gzappy_webhook_evento_event_type
  ON "GzappyWebhookEvento"("eventType");

CREATE INDEX IF NOT EXISTS idx_gzappy_webhook_evento_public_instance_id
  ON "GzappyWebhookEvento"("publicInstanceId");

CREATE INDEX IF NOT EXISTS idx_gzappy_webhook_evento_phone
  ON "GzappyWebhookEvento"(phone);

CREATE INDEX IF NOT EXISTS idx_gzappy_webhook_evento_message_id
  ON "GzappyWebhookEvento"("messageId");

COMMENT ON TABLE "GzappyWebhookEvento" IS 'Auditoria dos eventos recebidos pelo webhook da Gzappy';
COMMENT ON COLUMN "GzappyWebhookEvento"."eventType" IS 'Nome do evento recebido, como messages_upsert ou send_message';
COMMENT ON COLUMN "GzappyWebhookEvento"."direction" IS 'Direção inferida da mensagem: INBOUND ou OUTBOUND';
COMMENT ON COLUMN "GzappyWebhookEvento".payload IS 'Payload bruto recebido do webhook';
COMMENT ON COLUMN "GzappyWebhookEvento".headers IS 'Subset seguro dos headers HTTP recebidos';
COMMENT ON COLUMN "GzappyWebhookEvento"."processingStatus" IS 'Status do processamento interno do evento';
