-- Migration: Adicionar campo templateUrl na tabela Partida
-- Data: 2025-01-XX
-- Descrição: Permite armazenar a URL do template usado para gerar o card de cada partida

-- Adicionar coluna templateUrl (pode ser NULL para partidas antigas)
ALTER TABLE "Partida" 
ADD COLUMN IF NOT EXISTS "templateUrl" TEXT NULL;

-- Comentário na coluna para documentação
COMMENT ON COLUMN "Partida"."templateUrl" IS 'URL do template de fundo usado para gerar o card desta partida. Armazenado no Google Cloud Storage.';

-- Criar índice para melhorar performance em consultas futuras (opcional)
CREATE INDEX IF NOT EXISTS "idx_partida_templateUrl" ON "Partida"("templateUrl") WHERE "templateUrl" IS NOT NULL;

