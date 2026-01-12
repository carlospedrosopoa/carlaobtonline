-- Migration: Criar sistema de conta corrente para clientes
-- Permite lançamentos de créditos e débitos com justificativa obrigatória

-- Tabela para armazenar o saldo atual da conta corrente por cliente/arena
CREATE TABLE IF NOT EXISTS "ContaCorrenteCliente" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  saldo DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("usuarioId", "pointId")
);

COMMENT ON TABLE "ContaCorrenteCliente" IS 'Armazena o saldo atual da conta corrente de cada cliente por arena';
COMMENT ON COLUMN "ContaCorrenteCliente"."usuarioId" IS 'ID do usuário (cliente)';
COMMENT ON COLUMN "ContaCorrenteCliente"."pointId" IS 'ID da arena';
COMMENT ON COLUMN "ContaCorrenteCliente".saldo IS 'Saldo atual da conta corrente (pode ser negativo)';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_conta_corrente_usuario ON "ContaCorrenteCliente"("usuarioId");
CREATE INDEX IF NOT EXISTS idx_conta_corrente_point ON "ContaCorrenteCliente"("pointId");
CREATE INDEX IF NOT EXISTS idx_conta_corrente_usuario_point ON "ContaCorrenteCliente"("usuarioId", "pointId");

-- Tabela para histórico de movimentações (créditos e débitos)
CREATE TABLE IF NOT EXISTS "MovimentacaoContaCorrente" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "contaCorrenteId" TEXT NOT NULL REFERENCES "ContaCorrenteCliente"(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('CREDITO', 'DEBITO')),
  valor DECIMAL(10,2) NOT NULL,
  justificativa TEXT NOT NULL,
  "pagamentoCardId" TEXT REFERENCES "PagamentoCard"(id) ON DELETE SET NULL,
  "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE "MovimentacaoContaCorrente" IS 'Histórico de todas as movimentações (créditos e débitos) da conta corrente';
COMMENT ON COLUMN "MovimentacaoContaCorrente".tipo IS 'Tipo de movimentação: CREDITO ou DEBITO';
COMMENT ON COLUMN "MovimentacaoContaCorrente".valor IS 'Valor da movimentação (sempre positivo)';
COMMENT ON COLUMN "MovimentacaoContaCorrente".justificativa IS 'Justificativa obrigatória para a movimentação';
COMMENT ON COLUMN "MovimentacaoContaCorrente"."pagamentoCardId" IS 'ID do pagamento relacionado (quando for débito de pagamento de card)';
COMMENT ON COLUMN "MovimentacaoContaCorrente"."createdById" IS 'ID do usuário que criou a movimentação';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_movimentacao_conta ON "MovimentacaoContaCorrente"("contaCorrenteId");
CREATE INDEX IF NOT EXISTS idx_movimentacao_tipo ON "MovimentacaoContaCorrente"(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacao_pagamento ON "MovimentacaoContaCorrente"("pagamentoCardId");
CREATE INDEX IF NOT EXISTS idx_movimentacao_created_at ON "MovimentacaoContaCorrente"("createdAt" DESC);

