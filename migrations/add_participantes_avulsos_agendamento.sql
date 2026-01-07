-- Migração: Adicionar suporte a participantes avulsos em AgendamentoAtleta
-- Segue o mesmo padrão dos cards de clientes (nomeAvulso e telefoneAvulso)

-- IMPORTANTE: Remover constraint NOT NULL da coluna atletaId para permitir participantes avulsos
-- Primeiro, verificar se a constraint existe e removê-la
DO $$ 
BEGIN
  -- Verificar se atletaId tem constraint NOT NULL e removê-la
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'AgendamentoAtleta' 
      AND column_name = 'atletaId' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "AgendamentoAtleta" ALTER COLUMN "atletaId" DROP NOT NULL;
    RAISE NOTICE 'Constraint NOT NULL removida da coluna atletaId';
  ELSE
    RAISE NOTICE 'Coluna atletaId já permite NULL ou não existe';
  END IF;
END $$;

-- Adicionar colunas para participantes avulsos na tabela AgendamentoAtleta
ALTER TABLE "AgendamentoAtleta" 
ADD COLUMN IF NOT EXISTS "nomeAvulso" TEXT NULL,
ADD COLUMN IF NOT EXISTS "telefoneAvulso" TEXT NULL;

-- Comentários para documentação
COMMENT ON COLUMN "AgendamentoAtleta"."nomeAvulso" IS 'Nome do participante avulso (quando não há atletaId)';
COMMENT ON COLUMN "AgendamentoAtleta"."telefoneAvulso" IS 'Telefone do participante avulso (quando não há atletaId)';

-- Garantir que createdById existe (renomear createdBy se existir)
DO $$ 
BEGIN
  -- Se createdBy existe e createdById não existe, renomear
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AgendamentoAtleta' AND column_name = 'createdBy')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AgendamentoAtleta' AND column_name = 'createdById') THEN
    ALTER TABLE "AgendamentoAtleta" RENAME COLUMN "createdBy" TO "createdById";
  END IF;
  
  -- Se createdById não existe, criar
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AgendamentoAtleta' AND column_name = 'createdById') THEN
    ALTER TABLE "AgendamentoAtleta" ADD COLUMN "createdById" TEXT;
  END IF;
END $$;

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

-- A constraint UNIQUE ("agendamentoId", "atletaId") não funciona bem com NULL
-- Para participantes avulsos, permitimos múltiplos com o mesmo nome no mesmo agendamento
-- A constraint UNIQUE existente continua funcionando para atletas (quando atletaId não é NULL)

