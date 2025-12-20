-- Migration: Adicionar campo esporte na tabela Panelinha
-- Data: 2024-12-20
-- Descrição: Cada panelinha pode ter apenas um esporte associado

-- Adicionar coluna esporte na tabela Panelinha
ALTER TABLE "Panelinha" 
ADD COLUMN IF NOT EXISTS "esporte" VARCHAR(100);

-- Comentário na coluna para documentação
COMMENT ON COLUMN "Panelinha"."esporte" IS 'Esporte praticado nesta panelinha (ex: Beach Tennis, Futebol, etc.)';

-- Criar índice para melhorar performance em consultas por esporte
CREATE INDEX IF NOT EXISTS idx_panelinha_esporte 
ON "Panelinha"("esporte") 
WHERE "esporte" IS NOT NULL;


