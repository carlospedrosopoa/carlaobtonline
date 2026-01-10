-- Migration: Adicionar campo pagamentoOnlineAtivo na tabela Point
-- Permite habilitar/desabilitar o pagamento online para cada estabelecimento

ALTER TABLE "Point" 
  ADD COLUMN IF NOT EXISTS "pagamentoOnlineAtivo" BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN "Point"."pagamentoOnlineAtivo" IS 'Flag que indica se o pagamento online está habilitado para este estabelecimento. Quando ativo, o botão "Pagar Agora" aparece no appatleta.';

