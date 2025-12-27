-- Migration: Adicionar campo pointId na tabela Partida
-- Data: 2024-01-XX
-- Descrição: Vincula partidas diretamente às arenas (Point) para buscar template de card corretamente

-- Adicionar coluna pointId
ALTER TABLE "Partida" 
ADD COLUMN IF NOT EXISTS "pointId" TEXT DEFAULT NULL;

-- Adicionar foreign key constraint
ALTER TABLE "Partida"
ADD CONSTRAINT IF NOT EXISTS fk_partida_point 
FOREIGN KEY ("pointId") REFERENCES "Point"(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_partida_point_id ON "Partida"("pointId");

-- Comentário na coluna
COMMENT ON COLUMN "Partida"."pointId" IS 'ID da arena (Point) onde a partida foi realizada - usado para buscar template de card da arena';

