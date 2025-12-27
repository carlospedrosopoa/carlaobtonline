-- Migration: Adicionar coluna tiposEsporte na tabela Quadra
-- Data: 2024

-- Adicionar coluna tiposEsporte como JSONB (permite armazenar array de strings)
ALTER TABLE "Quadra" 
ADD COLUMN IF NOT EXISTS "tiposEsporte" JSONB DEFAULT NULL;

-- Comentário na coluna para documentação
COMMENT ON COLUMN "Quadra"."tiposEsporte" IS 'Array JSON de tipos de esporte que a quadra atende (ex: ["Tênis", "Futebol", "Vôlei"])';

