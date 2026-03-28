CREATE TABLE IF NOT EXISTS "ContaPagar" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  "fornecedorId" TEXT REFERENCES "Fornecedor"(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'PARCIAL', 'LIQUIDADA', 'CANCELADA')),
  "tipoDespesaId" TEXT REFERENCES "TipoDespesa"(id) ON DELETE SET NULL,
  "centroCustoId" TEXT REFERENCES "CentroCusto"(id) ON DELETE SET NULL,
  "codigoExterno" TEXT,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdById" TEXT REFERENCES "User"(id),
  "updatedById" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_conta_pagar_point ON "ContaPagar"("pointId");
CREATE INDEX IF NOT EXISTS idx_conta_pagar_status ON "ContaPagar"(status);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_fornecedor ON "ContaPagar"("fornecedorId");
CREATE INDEX IF NOT EXISTS idx_conta_pagar_tipo_despesa ON "ContaPagar"("tipoDespesaId");
CREATE INDEX IF NOT EXISTS idx_conta_pagar_centro_custo ON "ContaPagar"("centroCustoId");

CREATE TABLE IF NOT EXISTS "ContaPagarParcela" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "contaPagarId" TEXT NOT NULL REFERENCES "ContaPagar"(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  vencimento DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PARCIAL', 'LIQUIDADA', 'CANCELADA')),
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("contaPagarId", numero)
);

CREATE INDEX IF NOT EXISTS idx_conta_pagar_parcela_conta ON "ContaPagarParcela"("contaPagarId");
CREATE INDEX IF NOT EXISTS idx_conta_pagar_parcela_vencimento ON "ContaPagarParcela"(vencimento);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_parcela_status ON "ContaPagarParcela"(status);

CREATE TABLE IF NOT EXISTS "ContaPagarLiquidacao" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "parcelaId" TEXT NOT NULL REFERENCES "ContaPagarParcela"(id) ON DELETE CASCADE,
  "saidaCaixaId" TEXT REFERENCES "SaidaCaixa"(id) ON DELETE SET NULL,
  "contaBancariaId" TEXT,
  "origemFinanceira" TEXT NOT NULL DEFAULT 'CAIXA' CHECK ("origemFinanceira" IN ('CAIXA', 'CONTA_BANCARIA')),
  data DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  "formaPagamentoId" TEXT REFERENCES "FormaPagamento"(id) ON DELETE SET NULL,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdById" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_conta_pagar_liq_parcela ON "ContaPagarLiquidacao"("parcelaId");
CREATE INDEX IF NOT EXISTS idx_conta_pagar_liq_data ON "ContaPagarLiquidacao"(data);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_liq_saida ON "ContaPagarLiquidacao"("saidaCaixaId");
CREATE INDEX IF NOT EXISTS idx_conta_pagar_liq_origem ON "ContaPagarLiquidacao"("origemFinanceira");
CREATE INDEX IF NOT EXISTS idx_conta_pagar_liq_conta_bancaria ON "ContaPagarLiquidacao"("contaBancariaId");

CREATE TABLE IF NOT EXISTS "ContaBancaria" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo TEXT NOT NULL DEFAULT 'CONTA_CORRENTE' CHECK (tipo IN ('CONTA_CORRENTE', 'CONTA_POUPANCA', 'CARTEIRA', 'OUTRO')),
  "saldoInicial" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdById" TEXT REFERENCES "User"(id),
  "updatedById" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_conta_bancaria_point ON "ContaBancaria"("pointId");
CREATE INDEX IF NOT EXISTS idx_conta_bancaria_ativo ON "ContaBancaria"(ativo);

CREATE TABLE IF NOT EXISTS "MovimentacaoContaBancaria" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "contaBancariaId" TEXT NOT NULL REFERENCES "ContaBancaria"(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'MANUAL',
  "liquidacaoContaPagarId" TEXT REFERENCES "ContaPagarLiquidacao"(id) ON DELETE SET NULL,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdById" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_mov_bancaria_conta ON "MovimentacaoContaBancaria"("contaBancariaId");
CREATE INDEX IF NOT EXISTS idx_mov_bancaria_data ON "MovimentacaoContaBancaria"(data);
CREATE INDEX IF NOT EXISTS idx_mov_bancaria_origem ON "MovimentacaoContaBancaria"(origem);

CREATE TABLE IF NOT EXISTS "TransferenciaFinanceira" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  "origemTipo" TEXT NOT NULL CHECK ("origemTipo" IN ('CAIXA', 'CONTA_BANCARIA')),
  "origemAberturaCaixaId" TEXT REFERENCES "AberturaCaixa"(id) ON DELETE SET NULL,
  "origemContaBancariaId" TEXT REFERENCES "ContaBancaria"(id) ON DELETE SET NULL,
  "destinoTipo" TEXT NOT NULL CHECK ("destinoTipo" IN ('CAIXA', 'CONTA_BANCARIA')),
  "destinoAberturaCaixaId" TEXT REFERENCES "AberturaCaixa"(id) ON DELETE SET NULL,
  "destinoContaBancariaId" TEXT REFERENCES "ContaBancaria"(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdById" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_transferencia_financeira_point ON "TransferenciaFinanceira"("pointId");
CREATE INDEX IF NOT EXISTS idx_transferencia_financeira_data ON "TransferenciaFinanceira"(data);
CREATE INDEX IF NOT EXISTS idx_transferencia_financeira_origem_caixa ON "TransferenciaFinanceira"("origemAberturaCaixaId");
CREATE INDEX IF NOT EXISTS idx_transferencia_financeira_destino_caixa ON "TransferenciaFinanceira"("destinoAberturaCaixaId");
CREATE INDEX IF NOT EXISTS idx_transferencia_financeira_origem_conta ON "TransferenciaFinanceira"("origemContaBancariaId");
CREATE INDEX IF NOT EXISTS idx_transferencia_financeira_destino_conta ON "TransferenciaFinanceira"("destinoContaBancariaId");

ALTER TABLE "ContaPagarLiquidacao"
  ADD COLUMN IF NOT EXISTS "contaBancariaId" TEXT;

ALTER TABLE "ContaPagarLiquidacao"
  ADD COLUMN IF NOT EXISTS "origemFinanceira" TEXT NOT NULL DEFAULT 'CAIXA';

ALTER TABLE "MovimentacaoContaBancaria"
  ADD COLUMN IF NOT EXISTS "transferenciaFinanceiraId" TEXT;

ALTER TABLE "MovimentacaoContaBancaria"
  ADD COLUMN IF NOT EXISTS "pagamentoCardId" TEXT;

ALTER TABLE "FormaPagamento"
  ADD COLUMN IF NOT EXISTS "origemFinanceiraPadrao" TEXT NOT NULL DEFAULT 'CAIXA';

ALTER TABLE "FormaPagamento"
  ADD COLUMN IF NOT EXISTS "contaBancariaIdPadrao" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_conta_pagar_liq_conta_bancaria'
      AND table_name = 'ContaPagarLiquidacao'
  ) THEN
    ALTER TABLE "ContaPagarLiquidacao"
      ADD CONSTRAINT fk_conta_pagar_liq_conta_bancaria
      FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_mov_bancaria_pagamento_card'
      AND table_name = 'MovimentacaoContaBancaria'
  ) THEN
    ALTER TABLE "MovimentacaoContaBancaria"
      ADD CONSTRAINT fk_mov_bancaria_pagamento_card
      FOREIGN KEY ("pagamentoCardId") REFERENCES "PagamentoCard"(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mov_bancaria_pagamento_card ON "MovimentacaoContaBancaria"("pagamentoCardId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_forma_pagamento_conta_bancaria_padrao'
      AND table_name = 'FormaPagamento'
  ) THEN
    ALTER TABLE "FormaPagamento"
      ADD CONSTRAINT fk_forma_pagamento_conta_bancaria_padrao
      FOREIGN KEY ("contaBancariaIdPadrao") REFERENCES "ContaBancaria"(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_mov_bancaria_transferencia'
      AND table_name = 'MovimentacaoContaBancaria'
  ) THEN
    ALTER TABLE "MovimentacaoContaBancaria"
      ADD CONSTRAINT fk_mov_bancaria_transferencia
      FOREIGN KEY ("transferenciaFinanceiraId") REFERENCES "TransferenciaFinanceira"(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION trg_set_updated_at_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_conta_pagar ON "ContaPagar";
CREATE TRIGGER set_updated_at_conta_pagar
BEFORE UPDATE ON "ContaPagar"
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_conta_pagar();

DROP TRIGGER IF EXISTS set_updated_at_conta_pagar_parcela ON "ContaPagarParcela";
CREATE TRIGGER set_updated_at_conta_pagar_parcela
BEFORE UPDATE ON "ContaPagarParcela"
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_conta_pagar();

DROP TRIGGER IF EXISTS set_updated_at_conta_bancaria ON "ContaBancaria";
CREATE TRIGGER set_updated_at_conta_bancaria
BEFORE UPDATE ON "ContaBancaria"
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_conta_pagar();
