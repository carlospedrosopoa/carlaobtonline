-- Migration: Criar tabela PagamentoPagBank
-- Descrição: Armazena checkouts e pagamentos processados via PagBank

CREATE TABLE IF NOT EXISTS "PagamentoPagBank" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "cardId" TEXT NOT NULL REFERENCES "CardCliente"(id) ON DELETE CASCADE,
  "referenceId" TEXT NOT NULL UNIQUE,
  "checkoutId" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  valor DECIMAL(10, 2) NOT NULL,
  parcelas INTEGER DEFAULT 1,
  cpf TEXT,
  "chargeId" TEXT,
  "paymentMethod" TEXT,
  payload JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_PagamentoPagBank_cardId" ON "PagamentoPagBank"("cardId");
CREATE INDEX IF NOT EXISTS "idx_PagamentoPagBank_referenceId" ON "PagamentoPagBank"("referenceId");
CREATE INDEX IF NOT EXISTS "idx_PagamentoPagBank_checkoutId" ON "PagamentoPagBank"("checkoutId");
CREATE INDEX IF NOT EXISTS "idx_PagamentoPagBank_status" ON "PagamentoPagBank"(status);
CREATE INDEX IF NOT EXISTS "idx_PagamentoPagBank_createdAt" ON "PagamentoPagBank"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PagamentoCard' AND column_name = 'pagBankReferenceId'
  ) THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "pagBankReferenceId" TEXT;
    CREATE INDEX IF NOT EXISTS "idx_PagamentoCard_pagBankReferenceId" ON "PagamentoCard"("pagBankReferenceId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PagamentoCard' AND column_name = 'pagBankCheckoutId'
  ) THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "pagBankCheckoutId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PagamentoCard' AND column_name = 'pagBankChargeId'
  ) THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "pagBankChargeId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PagamentoCard' AND column_name = 'pagBankPaymentMethod'
  ) THEN
    ALTER TABLE "PagamentoCard" ADD COLUMN "pagBankPaymentMethod" TEXT;
  END IF;
END $$;

COMMENT ON TABLE "PagamentoPagBank" IS 'Armazena checkouts e pagamentos processados via PagBank';
COMMENT ON COLUMN "PagamentoPagBank"."referenceId" IS 'Reference id (orderId) usado para correlacionar checkout/pagamento no PagBank';
COMMENT ON COLUMN "PagamentoPagBank"."checkoutId" IS 'ID do checkout no PagBank (CHEC_...)';
COMMENT ON COLUMN "PagamentoPagBank"."chargeId" IS 'ID da cobrança no PagBank (CHAR_...)';
COMMENT ON COLUMN "PagamentoPagBank".status IS 'Status do checkout/pagamento no PagBank (PENDING/ACTIVE/INACTIVE/PAID/etc)';
