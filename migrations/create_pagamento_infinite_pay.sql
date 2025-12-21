-- Migration: Criar tabela PagamentoInfinitePay
-- Descrição: Armazena pagamentos processados via Infinite Pay

-- Tabela para armazenar pagamentos Infinite Pay
CREATE TABLE IF NOT EXISTS "PagamentoInfinitePay" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "cardId" TEXT NOT NULL REFERENCES "CardCliente"(id) ON DELETE CASCADE,
  "orderId" TEXT NOT NULL UNIQUE, -- ID único da ordem no Infinite Pay
  valor DECIMAL(10, 2) NOT NULL,
  parcelas INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
  "transactionId" TEXT, -- ID da transação no Infinite Pay
  message TEXT, -- Mensagem de retorno do Infinite Pay
  "pagamentoCardId" TEXT REFERENCES "PagamentoCard"(id) ON DELETE SET NULL, -- Link para o pagamento criado no card
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS "idx_PagamentoInfinitePay_cardId" ON "PagamentoInfinitePay"("cardId");
CREATE INDEX IF NOT EXISTS "idx_PagamentoInfinitePay_orderId" ON "PagamentoInfinitePay"("orderId");
CREATE INDEX IF NOT EXISTS "idx_PagamentoInfinitePay_status" ON "PagamentoInfinitePay"("status");
CREATE INDEX IF NOT EXISTS "idx_PagamentoInfinitePay_createdAt" ON "PagamentoInfinitePay"("createdAt");

-- Adicionar campos ao PagamentoCard se não existirem
DO $$ 
BEGIN
  -- Adicionar campo infinitePayOrderId se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'PagamentoCard' AND column_name = 'infinitePayOrderId'
  ) THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "infinitePayOrderId" TEXT;
    CREATE INDEX IF NOT EXISTS "idx_PagamentoCard_infinitePayOrderId" ON "PagamentoCard"("infinitePayOrderId");
  END IF;

  -- Adicionar campo infinitePayTransactionId se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'PagamentoCard' AND column_name = 'infinitePayTransactionId'
  ) THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "infinitePayTransactionId" TEXT;
  END IF;
END $$;

-- Comentários
COMMENT ON TABLE "PagamentoInfinitePay" IS 'Armazena pagamentos processados via Infinite Pay';
COMMENT ON COLUMN "PagamentoInfinitePay"."orderId" IS 'ID único da ordem no Infinite Pay';
COMMENT ON COLUMN "PagamentoInfinitePay"."transactionId" IS 'ID da transação retornado pelo Infinite Pay';
COMMENT ON COLUMN "PagamentoInfinitePay".status IS 'Status do pagamento: PENDING, APPROVED, REJECTED, CANCELLED';

