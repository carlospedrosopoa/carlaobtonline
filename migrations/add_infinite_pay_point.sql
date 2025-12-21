-- Migration: Adicionar campo infinitePayHandle na tabela Point
-- Descrição: Permite que cada arena configure seu próprio handle do Infinite Pay

-- Adicionar campo infinitePayHandle na tabela Point
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Point' AND column_name = 'infinitePayHandle'
  ) THEN
    ALTER TABLE "Point" ADD COLUMN "infinitePayHandle" TEXT;
    CREATE INDEX IF NOT EXISTS "idx_Point_infinitePayHandle" ON "Point"("infinitePayHandle") WHERE "infinitePayHandle" IS NOT NULL;
  END IF;
END $$;

-- Comentário
COMMENT ON COLUMN "Point"."infinitePayHandle" IS 'Handle da conta Infinite Pay da arena. Cada arena pode ter sua própria conta.';

