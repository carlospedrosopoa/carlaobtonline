-- Migration: Adicionar colunas de esportes na tabela Atleta
-- Data: 2024

-- Adicionar coluna esportePreferido (esporte preferido do atleta, usado como padrão nas seleções)
ALTER TABLE "Atleta" 
ADD COLUMN IF NOT EXISTS "esportePreferido" VARCHAR(100) DEFAULT NULL;

-- Adicionar coluna esportesPratica como JSONB (permite armazenar array de strings)
ALTER TABLE "Atleta" 
ADD COLUMN IF NOT EXISTS "esportesPratica" JSONB DEFAULT NULL;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN "Atleta"."esportePreferido" IS 'Esporte preferido do atleta (usado como padrão nas seleções)';
COMMENT ON COLUMN "Atleta"."esportesPratica" IS 'Array JSON de esportes que o atleta pratica (ex: ["Tênis", "Futebol", "Vôlei"])';

