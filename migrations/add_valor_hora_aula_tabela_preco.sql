-- Migration: Adicionar campo valorHoraAula na tabela TabelaPreco
-- Data: 2024-01-XX
-- Descrição: Adiciona campo para armazenar o valor de locação por hora para aulas/professores

-- Adicionar coluna valorHoraAula (opcional, nullable para manter compatibilidade)
ALTER TABLE "TabelaPreco" 
ADD COLUMN IF NOT EXISTS "valorHoraAula" NUMERIC(10, 2) DEFAULT NULL;

-- Comentário na coluna
COMMENT ON COLUMN "TabelaPreco"."valorHoraAula" IS 'Valor de locação por hora para aulas/professores. Se null, usa o mesmo valor de valorHora (atleta).';

