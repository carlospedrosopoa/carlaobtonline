-- Migration: Adicionar campos de auditoria nas tabelas de Fluxo de Caixa
-- Data: 2024-12-31
-- Descrição: Adiciona campos para rastrear quem criou e atualizou operações financeiras

-- EntradaCaixa - Verificar se já tem createdBy antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'EntradaCaixa' AND column_name = 'createdById') THEN
    ALTER TABLE "EntradaCaixa" ADD COLUMN "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_entrada_caixa_created_by_id ON "EntradaCaixa"("createdById");
    COMMENT ON COLUMN "EntradaCaixa"."createdById" IS 'ID do usuário que criou a entrada de caixa';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'EntradaCaixa' AND column_name = 'updatedById') THEN
    ALTER TABLE "EntradaCaixa" ADD COLUMN "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_entrada_caixa_updated_by_id ON "EntradaCaixa"("updatedById");
    COMMENT ON COLUMN "EntradaCaixa"."updatedById" IS 'ID do usuário que fez a última atualização da entrada de caixa';
  END IF;
END $$;

-- SaidaCaixa
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'SaidaCaixa' AND column_name = 'createdById') THEN
    ALTER TABLE "SaidaCaixa" ADD COLUMN "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_saida_caixa_created_by_id ON "SaidaCaixa"("createdById");
    COMMENT ON COLUMN "SaidaCaixa"."createdById" IS 'ID do usuário que criou a saída de caixa';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'SaidaCaixa' AND column_name = 'updatedById') THEN
    ALTER TABLE "SaidaCaixa" ADD COLUMN "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_saida_caixa_updated_by_id ON "SaidaCaixa"("updatedById");
    COMMENT ON COLUMN "SaidaCaixa"."updatedById" IS 'ID do usuário que fez a última atualização da saída de caixa';
  END IF;
END $$;

-- PagamentoCard - Verificar se já tem createdBy antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'PagamentoCard' AND column_name = 'createdById') THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_pagamento_card_created_by_id ON "PagamentoCard"("createdById");
    COMMENT ON COLUMN "PagamentoCard"."createdById" IS 'ID do usuário que criou o pagamento do card';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'PagamentoCard' AND column_name = 'updatedById') THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_pagamento_card_updated_by_id ON "PagamentoCard"("updatedById");
    COMMENT ON COLUMN "PagamentoCard"."updatedById" IS 'ID do usuário que fez a última atualização do pagamento do card';
  END IF;
END $$;

-- AberturaCaixa
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'AberturaCaixa' AND column_name = 'createdById') THEN
    ALTER TABLE "AberturaCaixa" ADD COLUMN "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_abertura_caixa_created_by_id ON "AberturaCaixa"("createdById");
    COMMENT ON COLUMN "AberturaCaixa"."createdById" IS 'ID do usuário que abriu o caixa';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'AberturaCaixa' AND column_name = 'updatedById') THEN
    ALTER TABLE "AberturaCaixa" ADD COLUMN "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_abertura_caixa_updated_by_id ON "AberturaCaixa"("updatedById");
    COMMENT ON COLUMN "AberturaCaixa"."updatedById" IS 'ID do usuário que fez a última atualização da abertura de caixa';
  END IF;
END $$;

