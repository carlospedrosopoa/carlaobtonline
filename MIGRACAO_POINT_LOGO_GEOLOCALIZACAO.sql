-- Migração: Adicionar campos de logotipo e geolocalização na tabela Point
-- Execute este script no seu banco de dados PostgreSQL

-- Adicionar coluna logoUrl (armazena URL ou base64 da imagem)
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

-- Adicionar colunas de geolocalização
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Verificar se as colunas foram criadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Point' 
AND column_name IN ('logoUrl', 'latitude', 'longitude');

