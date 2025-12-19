-- Migration: Criar tabela para controlar notificações de agendamento enviadas
-- Data: 2024

-- Criar tabela para registrar notificações enviadas (evitar duplicatas)
CREATE TABLE IF NOT EXISTS "NotificacaoAgendamento" (
  id TEXT PRIMARY KEY,
  "agendamentoId" TEXT NOT NULL REFERENCES "Agendamento"(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'LEMBRETE_8H', 'LEMBRETE_24H', etc.
  enviada BOOLEAN NOT NULL DEFAULT false,
  "dataEnvio" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Comentários nas colunas
COMMENT ON TABLE "NotificacaoAgendamento" IS 'Registra notificações de agendamento enviadas para evitar duplicatas';
COMMENT ON COLUMN "NotificacaoAgendamento"."agendamentoId" IS 'ID do agendamento relacionado';
COMMENT ON COLUMN "NotificacaoAgendamento".tipo IS 'Tipo de notificação (ex: LEMBRETE_8H, LEMBRETE_24H)';
COMMENT ON COLUMN "NotificacaoAgendamento".enviada IS 'Indica se a notificação foi enviada com sucesso';
COMMENT ON COLUMN "NotificacaoAgendamento"."dataEnvio" IS 'Data e hora em que a notificação foi enviada';

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_notificacao_agendamento_id 
ON "NotificacaoAgendamento"("agendamentoId", tipo, enviada);

CREATE INDEX IF NOT EXISTS idx_notificacao_agendamento_tipo 
ON "NotificacaoAgendamento"(tipo, enviada);

