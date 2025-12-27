-- Migration: Adicionar campos de foto e logo ao Professor
-- Data: 2024-01-XX
-- Descrição: Adiciona campos fotoUrl e logoUrl para armazenar URLs das imagens no GCS

-- Adicionar coluna fotoUrl
ALTER TABLE "Professor" 
ADD COLUMN IF NOT EXISTS "fotoUrl" TEXT DEFAULT NULL;

-- Adicionar coluna logoUrl
ALTER TABLE "Professor" 
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT DEFAULT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN "Professor"."fotoUrl" IS 'URL da foto do professor armazenada no Google Cloud Storage';
COMMENT ON COLUMN "Professor"."logoUrl" IS 'URL da logomarca do professor armazenada no Google Cloud Storage';

