-- Migration: Adicionar campo cardTemplateUrl ao Point
-- Data: 2024-01-XX
-- Descrição: Adiciona campo para armazenar URL do template de card de jogos específico de cada arena

-- Adicionar coluna cardTemplateUrl
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS "cardTemplateUrl" TEXT DEFAULT NULL;

-- Comentário na coluna
COMMENT ON COLUMN "Point"."cardTemplateUrl" IS 'URL do template de card de jogos armazenada no Google Cloud Storage (pasta templates/cards)';

