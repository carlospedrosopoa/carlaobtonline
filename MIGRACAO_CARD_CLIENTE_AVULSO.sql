-- ============================================
-- MIGRAÇÃO: Adicionar campos de cliente avulso ao CardCliente
-- ============================================
-- Adiciona campos para permitir cadastrar cliente avulso (nome e telefone)
-- quando não houver usuário vinculado

ALTER TABLE "CardCliente" 
ADD COLUMN IF NOT EXISTS "nomeAvulso" TEXT,
ADD COLUMN IF NOT EXISTS "telefoneAvulso" TEXT;

-- Comentário explicativo
COMMENT ON COLUMN "CardCliente"."nomeAvulso" IS 'Nome do cliente quando não há usuário vinculado (cliente avulso)';
COMMENT ON COLUMN "CardCliente"."telefoneAvulso" IS 'Telefone do cliente quando não há usuário vinculado (cliente avulso)';

