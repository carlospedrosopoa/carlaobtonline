-- Migration: Adicionar campos de auditoria na tabela ItemCard
-- Data: 2025-01-02
-- Descrição: Adiciona campos para rastrear quem criou e atualizou itens de card

-- ItemCard
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'ItemCard' AND column_name = 'createdById') THEN
    ALTER TABLE "ItemCard" ADD COLUMN "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_item_card_created_by_id ON "ItemCard"("createdById");
    COMMENT ON COLUMN "ItemCard"."createdById" IS 'ID do usuário que adicionou o item ao card';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'ItemCard' AND column_name = 'updatedById') THEN
    ALTER TABLE "ItemCard" ADD COLUMN "updatedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_item_card_updated_by_id ON "ItemCard"("updatedById");
    COMMENT ON COLUMN "ItemCard"."updatedById" IS 'ID do usuário que fez a última atualização do item';
  END IF;
END $$;

