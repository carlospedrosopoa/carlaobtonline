-- Script para adicionar flag de assinante nas tabelas Point e Atleta
-- Execute este script no banco de dados para adicionar controle de assinaturas

-- Adicionar coluna assinante na tabela Point (Arena)
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS assinante BOOLEAN DEFAULT false;

-- Adicionar coluna assinante na tabela Atleta
ALTER TABLE "Atleta" 
ADD COLUMN IF NOT EXISTS assinante BOOLEAN DEFAULT false;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN "Point".assinante IS 'Indica se a arena possui assinatura ativa (apenas ADMIN pode alterar)';
COMMENT ON COLUMN "Atleta".assinante IS 'Indica se o atleta possui assinatura ativa (apenas ADMIN pode alterar)';

-- Criar índices para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_point_assinante ON "Point"(assinante) WHERE assinante = true;
CREATE INDEX IF NOT EXISTS idx_atleta_assinante ON "Atleta"(assinante) WHERE assinante = true;

