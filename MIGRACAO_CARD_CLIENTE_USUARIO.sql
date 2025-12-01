-- ============================================
-- MIGRAÇÃO: Vincular CardCliente a Usuário
-- ============================================
-- Adiciona campo usuarioId na tabela CardCliente para permitir
-- que usuários do tipo User tenham acesso aos seus cards de consumo

-- Adicionar coluna usuarioId na tabela CardCliente
ALTER TABLE "CardCliente" 
ADD COLUMN IF NOT EXISTS "usuarioId" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance nas consultas por usuário
CREATE INDEX IF NOT EXISTS idx_card_cliente_usuario ON "CardCliente"("usuarioId");

-- Comentário na coluna
COMMENT ON COLUMN "CardCliente"."usuarioId" IS 'Usuário vinculado ao card (opcional). Permite que o usuário acesse seu histórico de consumo.';

