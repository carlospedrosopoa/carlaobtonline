-- Migration: Adicionar campos de reset de senha na tabela User
-- Data: 2025-01-21
-- Descrição: Adiciona campos resetToken e resetTokenExpiry para permitir recuperação de senha

-- Adicionar colunas para reset de senha (se não existirem)
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "resetToken" TEXT,
ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP;

-- Criar índice para melhorar performance nas buscas por token
CREATE INDEX IF NOT EXISTS "idx_user_reset_token" ON "User"("resetToken") 
WHERE "resetToken" IS NOT NULL;

-- Comentário: Esta migration adiciona suporte para recuperação de senha
-- O token é gerado quando o usuário solicita recuperação e expira em 1 hora
-- Após o reset, o token é limpo do banco de dados

