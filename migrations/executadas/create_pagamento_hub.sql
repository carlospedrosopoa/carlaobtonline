CREATE TABLE IF NOT EXISTS "PagamentoHub" (
  "transactionId" TEXT PRIMARY KEY,
  "projectName" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL,
  "valor" NUMERIC(12,2) NOT NULL,
  "pagbankOrderId" TEXT NULL,
  "cardId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "pagamentoCardId" TEXT NULL,
  "metadata" JSONB NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "PagamentoHub_project_order_uk"
  ON "PagamentoHub" ("projectName", "orderId");

CREATE INDEX IF NOT EXISTS "PagamentoHub_card_idx"
  ON "PagamentoHub" ("cardId");

CREATE INDEX IF NOT EXISTS "PagamentoHub_point_idx"
  ON "PagamentoHub" ("pointId");

CREATE INDEX IF NOT EXISTS "PagamentoHub_usuario_idx"
  ON "PagamentoHub" ("usuarioId");

