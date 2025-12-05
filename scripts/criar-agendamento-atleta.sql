-- Script para criar tabela de relacionamento entre Agendamento e Atleta
-- Permite que um agendamento tenha múltiplos atletas participantes

-- Criar tabela de relacionamento
CREATE TABLE IF NOT EXISTS "AgendamentoAtleta" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "agendamentoId" TEXT NOT NULL REFERENCES "Agendamento"(id) ON DELETE CASCADE,
  "atletaId" TEXT NOT NULL REFERENCES "Atleta"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT REFERENCES "User"(id),
  UNIQUE("agendamentoId", "atletaId") -- Evitar duplicatas
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_agendamento_atleta_agendamento ON "AgendamentoAtleta"("agendamentoId");
CREATE INDEX IF NOT EXISTS idx_agendamento_atleta_atleta ON "AgendamentoAtleta"("atletaId");

-- Comentários para documentação
COMMENT ON TABLE "AgendamentoAtleta" IS 'Relacionamento muitos-para-muitos entre Agendamento e Atleta. Permite que um agendamento tenha múltiplos participantes.';
COMMENT ON COLUMN "AgendamentoAtleta"."agendamentoId" IS 'ID do agendamento';
COMMENT ON COLUMN "AgendamentoAtleta"."atletaId" IS 'ID do atleta participante';
COMMENT ON COLUMN "AgendamentoAtleta"."createdBy" IS 'ID do usuário que adicionou o atleta ao agendamento';

