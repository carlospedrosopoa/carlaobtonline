-- Migration: Criar tabela de contexto para interacoes de agendamento via Gzappy

CREATE TABLE IF NOT EXISTS "GzappyInteracaoAgendamento" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "agendamentoId" TEXT NOT NULL REFERENCES "Agendamento"(id) ON DELETE CASCADE,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  "publicInstanceId" TEXT,
  phone TEXT NOT NULL,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AGUARDANDO_RESPOSTA',
  "mensagemEnviada" TEXT,
  "respostaRecebida" TEXT,
  "respostaMessageId" TEXT,
  "respostaRecebidaEm" TIMESTAMPTZ,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gzappy_interacao_agendamento_lookup
  ON "GzappyInteracaoAgendamento"(phone, status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_gzappy_interacao_agendamento_agendamento
  ON "GzappyInteracaoAgendamento"("agendamentoId");

CREATE INDEX IF NOT EXISTS idx_gzappy_interacao_agendamento_instance
  ON "GzappyInteracaoAgendamento"("publicInstanceId");

COMMENT ON TABLE "GzappyInteracaoAgendamento" IS 'Contexto das mensagens interativas de agendamento enviadas via Gzappy';
COMMENT ON COLUMN "GzappyInteracaoAgendamento".tipo IS 'Tipo da mensagem enviada ao atleta, como NOVO_AGENDAMENTO ou ALTERACAO_AGENDAMENTO';
COMMENT ON COLUMN "GzappyInteracaoAgendamento".status IS 'Status da interacao: AGUARDANDO_RESPOSTA, CONFIRMADO_RECEBIMENTO ou SOLICITOU_CONTATO';
COMMENT ON COLUMN "GzappyInteracaoAgendamento".metadata IS 'Dados auxiliares do agendamento usados no processamento da resposta';
