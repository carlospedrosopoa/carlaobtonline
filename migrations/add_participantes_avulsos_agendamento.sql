-- Migração: Adicionar suporte a participantes avulsos em AgendamentoAtleta
-- Segue o mesmo padrão dos cards de clientes (nomeAvulso e telefoneAvulso)

-- Adicionar colunas para participantes avulsos na tabela AgendamentoAtleta
ALTER TABLE "AgendamentoAtleta" 
ADD COLUMN IF NOT EXISTS "nomeAvulso" TEXT NULL,
ADD COLUMN IF NOT EXISTS "telefoneAvulso" TEXT NULL;

-- Comentários para documentação
COMMENT ON COLUMN "AgendamentoAtleta"."nomeAvulso" IS 'Nome do participante avulso (quando não há atletaId)';
COMMENT ON COLUMN "AgendamentoAtleta"."telefoneAvulso" IS 'Telefone do participante avulso (quando não há atletaId)';

-- Adicionar constraint: deve ter OU atletaId OU nomeAvulso
-- Primeiro, remover a constraint se já existir (para permitir re-execução)
ALTER TABLE "AgendamentoAtleta"
DROP CONSTRAINT IF EXISTS "check_participante_valido";

-- Adicionar a constraint
ALTER TABLE "AgendamentoAtleta"
ADD CONSTRAINT "check_participante_valido" 
CHECK (
  ("atletaId" IS NOT NULL AND "nomeAvulso" IS NULL) OR 
  ("atletaId" IS NULL AND "nomeAvulso" IS NOT NULL)
);

