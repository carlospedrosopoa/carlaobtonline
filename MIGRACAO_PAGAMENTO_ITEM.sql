-- ============================================
-- MIGRAÇÃO: Vincular pagamentos a itens específicos
-- ============================================
-- Permite que cada pagamento seja vinculado a itens específicos do card
-- Isso permite que múltiplas pessoas paguem itens diferentes do mesmo card

CREATE TABLE IF NOT EXISTS "PagamentoItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pagamentoCardId" TEXT NOT NULL REFERENCES "PagamentoCard"(id) ON DELETE CASCADE,
  "itemCardId" TEXT NOT NULL REFERENCES "ItemCard"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("pagamentoCardId", "itemCardId")
);

CREATE INDEX IF NOT EXISTS idx_pagamento_item_pagamento ON "PagamentoItem"("pagamentoCardId");
CREATE INDEX IF NOT EXISTS idx_pagamento_item_item ON "PagamentoItem"("itemCardId");

COMMENT ON TABLE "PagamentoItem" IS 'Relacionamento entre pagamentos e itens do card, permitindo que cada pagamento seja vinculado a itens específicos';

