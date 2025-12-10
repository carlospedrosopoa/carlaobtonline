-- Script para adicionar campos de configuração Gzappy na tabela Point
-- Execute este script no banco de dados para adicionar suporte a configurações Gzappy por arena

-- Adicionar colunas de configuração Gzappy
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS "gzappyApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "gzappyInstanceId" TEXT,
ADD COLUMN IF NOT EXISTS "gzappyAtivo" BOOLEAN DEFAULT false;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN "Point"."gzappyApiKey" IS 'Chave de API do Gzappy para autenticação';
COMMENT ON COLUMN "Point"."gzappyInstanceId" IS 'ID da instância do Gzappy configurada para esta arena';
COMMENT ON COLUMN "Point"."gzappyAtivo" IS 'Indica se o Gzappy está ativo para esta arena';

-- Criar índice para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_point_gzappy_ativo ON "Point"("gzappyAtivo") WHERE "gzappyAtivo" = true;

