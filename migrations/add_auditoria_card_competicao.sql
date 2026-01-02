-- Migration: Adicionar campos de auditoria nas tabelas CardCliente e Competições
-- Data: 2024-12-31
-- Descrição: Adiciona campos para rastrear quem criou e atualizou registros

-- CardCliente - Verificar se já tem createdBy antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'CardCliente' AND column_name = 'createdById') THEN
    ALTER TABLE "CardCliente" ADD COLUMN "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_card_cliente_created_by_id ON "CardCliente"("createdById");
    COMMENT ON COLUMN "CardCliente"."createdById" IS 'ID do usuário que criou o card de cliente';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'CardCliente' AND column_name = 'updatedById') THEN
    ALTER TABLE "CardCliente" ADD COLUMN "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_card_cliente_updated_by_id ON "CardCliente"("updatedById");
    COMMENT ON COLUMN "CardCliente"."updatedById" IS 'ID do usuário que fez a última atualização do card de cliente';
  END IF;
END $$;

-- Competicao
ALTER TABLE "Competicao" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
ALTER TABLE "Competicao" ADD COLUMN IF NOT EXISTS "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_competicao_created_by_id ON "Competicao"("createdById");
CREATE INDEX IF NOT EXISTS idx_competicao_updated_by_id ON "Competicao"("updatedById");

COMMENT ON COLUMN "Competicao"."createdById" IS 'ID do usuário que criou a competição';
COMMENT ON COLUMN "Competicao"."updatedById" IS 'ID do usuário que fez a última atualização da competição';

-- JogoCompeticao
ALTER TABLE "JogoCompeticao" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
ALTER TABLE "JogoCompeticao" ADD COLUMN IF NOT EXISTS "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jogo_competicao_created_by_id ON "JogoCompeticao"("createdById");
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_updated_by_id ON "JogoCompeticao"("updatedById");

COMMENT ON COLUMN "JogoCompeticao"."createdById" IS 'ID do usuário que criou o jogo da competição';
COMMENT ON COLUMN "JogoCompeticao"."updatedById" IS 'ID do usuário que fez a última atualização do jogo da competição';

-- AtletaCompeticao
ALTER TABLE "AtletaCompeticao" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
ALTER TABLE "AtletaCompeticao" ADD COLUMN IF NOT EXISTS "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atleta_competicao_created_by_id ON "AtletaCompeticao"("createdById");
CREATE INDEX IF NOT EXISTS idx_atleta_competicao_updated_by_id ON "AtletaCompeticao"("updatedById");

COMMENT ON COLUMN "AtletaCompeticao"."createdById" IS 'ID do usuário que inscreveu o atleta na competição';
COMMENT ON COLUMN "AtletaCompeticao"."updatedById" IS 'ID do usuário que fez a última atualização da inscrição';

