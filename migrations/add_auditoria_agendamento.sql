-- Migration: Adicionar campos de auditoria na tabela Agendamento
-- Data: 2024-12-31
-- Descrição: Adiciona campos para rastrear quem criou e atualizou cada agendamento

-- Adicionar campos de auditoria
ALTER TABLE "Agendamento" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
ALTER TABLE "Agendamento" ADD COLUMN IF NOT EXISTS "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

-- Criar índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_agendamento_created_by_id ON "Agendamento"("createdById");
CREATE INDEX IF NOT EXISTS idx_agendamento_updated_by_id ON "Agendamento"("updatedById");

-- Comentários nas colunas
COMMENT ON COLUMN "Agendamento"."createdById" IS 'ID do usuário que criou o agendamento';
COMMENT ON COLUMN "Agendamento"."updatedById" IS 'ID do usuário que fez a última atualização do agendamento';

