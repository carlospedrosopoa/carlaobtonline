-- Migração: Adicionar campo competicaoId na tabela Agendamento
-- Para vincular agendamentos de quadras a competições
-- Data: 2024-12-26

BEGIN;

-- 1. Adicionar a coluna "competicaoId"
ALTER TABLE "Agendamento"
ADD COLUMN IF NOT EXISTS "competicaoId" TEXT DEFAULT NULL;

-- 2. Adicionar foreign key constraint
ALTER TABLE "Agendamento"
ADD CONSTRAINT fk_agendamento_competicao 
FOREIGN KEY ("competicaoId") REFERENCES "Competicao"(id) ON DELETE CASCADE;

-- 3. Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_agendamento_competicao_id 
ON "Agendamento"("competicaoId");

-- 4. Comentários para documentação
COMMENT ON COLUMN "Agendamento"."competicaoId" IS 'ID da competição relacionada ao agendamento. Quando um agendamento é vinculado a uma competição, a competição pode usar múltiplas quadras e horários.';

COMMIT;

