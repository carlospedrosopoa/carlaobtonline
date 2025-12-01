-- ============================================
-- MIGRAÇÃO: Sistema de Gestão da Arena
-- ============================================
-- Este script cria todas as tabelas necessárias para o sistema de gestão da arena
-- incluindo: Cards de Clientes, Produtos, Formas de Pagamento, Fornecedores,
-- Categorias, Centro de Custo, Entradas e Saídas de Caixa

-- ============================================
-- 1. CARDS DE CLIENTES (Atendimentos)
-- ============================================
CREATE TABLE IF NOT EXISTS "CardCliente" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  "numeroCard" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ABERTO' CHECK ("status" IN ('ABERTO', 'FECHADO', 'CANCELADO')),
  "observacoes" TEXT,
  "valorTotal" DECIMAL(10,2) DEFAULT 0,
  "usuarioId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" TEXT REFERENCES "User"(id),
  "fechadoAt" TIMESTAMP WITH TIME ZONE,
  "fechadoBy" TEXT REFERENCES "User"(id),
  UNIQUE("pointId", "numeroCard")
);

CREATE INDEX IF NOT EXISTS idx_card_cliente_point ON "CardCliente"("pointId");
CREATE INDEX IF NOT EXISTS idx_card_cliente_status ON "CardCliente"("status");
CREATE INDEX IF NOT EXISTS idx_card_cliente_numero ON "CardCliente"("numeroCard");
CREATE INDEX IF NOT EXISTS idx_card_cliente_usuario ON "CardCliente"("usuarioId");

-- ============================================
-- 2. PRODUTOS
-- ============================================
CREATE TABLE IF NOT EXISTS "Produto" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  "precoVenda" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "precoCusto" DECIMAL(10,2) DEFAULT 0,
  categoria TEXT,
  ativo BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("pointId", nome)
);

CREATE INDEX IF NOT EXISTS idx_produto_point ON "Produto"("pointId");
CREATE INDEX IF NOT EXISTS idx_produto_ativo ON "Produto"(ativo);

-- ============================================
-- 3. ITENS DO CARD (Produtos vendidos no card)
-- ============================================
CREATE TABLE IF NOT EXISTS "ItemCard" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "cardId" TEXT NOT NULL REFERENCES "CardCliente"(id) ON DELETE CASCADE,
  "produtoId" TEXT NOT NULL REFERENCES "Produto"(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  "precoUnitario" DECIMAL(10,2) NOT NULL,
  "precoTotal" DECIMAL(10,2) NOT NULL,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_card_card ON "ItemCard"("cardId");
CREATE INDEX IF NOT EXISTS idx_item_card_produto ON "ItemCard"("produtoId");

-- ============================================
-- 4. FORMAS DE PAGAMENTO
-- ============================================
CREATE TABLE IF NOT EXISTS "FormaPagamento" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'OUTRO')),
  ativo BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("pointId", nome)
);

CREATE INDEX IF NOT EXISTS idx_forma_pagamento_point ON "FormaPagamento"("pointId");
CREATE INDEX IF NOT EXISTS idx_forma_pagamento_ativo ON "FormaPagamento"(ativo);

-- ============================================
-- 5. PAGAMENTOS DO CARD
-- ============================================
CREATE TABLE IF NOT EXISTS "PagamentoCard" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "cardId" TEXT NOT NULL REFERENCES "CardCliente"(id) ON DELETE CASCADE,
  "formaPagamentoId" TEXT NOT NULL REFERENCES "FormaPagamento"(id),
  valor DECIMAL(10,2) NOT NULL,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_pagamento_card_card ON "PagamentoCard"("cardId");
CREATE INDEX IF NOT EXISTS idx_pagamento_card_forma ON "PagamentoCard"("formaPagamentoId");

-- ============================================
-- 6. FORNECEDORES
-- ============================================
CREATE TABLE IF NOT EXISTS "Fornecedor" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  "nomeFantasia" TEXT,
  cnpj TEXT,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("pointId", nome)
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_point ON "Fornecedor"("pointId");
CREATE INDEX IF NOT EXISTS idx_fornecedor_ativo ON "Fornecedor"(ativo);

-- ============================================
-- 7. CATEGORIAS DE SAÍDA
-- ============================================
CREATE TABLE IF NOT EXISTS "CategoriaSaida" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("pointId", nome)
);

CREATE INDEX IF NOT EXISTS idx_categoria_saida_point ON "CategoriaSaida"("pointId");
CREATE INDEX IF NOT EXISTS idx_categoria_saida_ativo ON "CategoriaSaida"(ativo);

-- ============================================
-- 8. CENTRO DE CUSTO
-- ============================================
CREATE TABLE IF NOT EXISTS "CentroCusto" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("pointId", nome)
);

CREATE INDEX IF NOT EXISTS idx_centro_custo_point ON "CentroCusto"("pointId");
CREATE INDEX IF NOT EXISTS idx_centro_custo_ativo ON "CentroCusto"(ativo);

-- ============================================
-- 9. ENTRADAS DE CAIXA (Manuais)
-- ============================================
CREATE TABLE IF NOT EXISTS "EntradaCaixa" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  "formaPagamentoId" TEXT NOT NULL REFERENCES "FormaPagamento"(id),
  observacoes TEXT,
  "dataEntrada" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_entrada_caixa_point ON "EntradaCaixa"("pointId");
CREATE INDEX IF NOT EXISTS idx_entrada_caixa_data ON "EntradaCaixa"("dataEntrada");
CREATE INDEX IF NOT EXISTS idx_entrada_caixa_forma ON "EntradaCaixa"("formaPagamentoId");

-- ============================================
-- 10. SAÍDAS DE CAIXA (Manuais)
-- ============================================
CREATE TABLE IF NOT EXISTS "SaidaCaixa" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL REFERENCES "Point"(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  "fornecedorId" TEXT REFERENCES "Fornecedor"(id),
  "categoriaSaidaId" TEXT NOT NULL REFERENCES "CategoriaSaida"(id),
  "centroCustoId" TEXT NOT NULL REFERENCES "CentroCusto"(id),
  "formaPagamentoId" TEXT NOT NULL REFERENCES "FormaPagamento"(id),
  observacoes TEXT,
  "dataSaida" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" TEXT REFERENCES "User"(id)
);

CREATE INDEX IF NOT EXISTS idx_saida_caixa_point ON "SaidaCaixa"("pointId");
CREATE INDEX IF NOT EXISTS idx_saida_caixa_data ON "SaidaCaixa"("dataSaida");
CREATE INDEX IF NOT EXISTS idx_saida_caixa_fornecedor ON "SaidaCaixa"("fornecedorId");
CREATE INDEX IF NOT EXISTS idx_saida_caixa_categoria ON "SaidaCaixa"("categoriaSaidaId");
CREATE INDEX IF NOT EXISTS idx_saida_caixa_centro ON "SaidaCaixa"("centroCustoId");
CREATE INDEX IF NOT EXISTS idx_saida_caixa_forma ON "SaidaCaixa"("formaPagamentoId");

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas com updatedAt
CREATE TRIGGER update_card_cliente_updated_at BEFORE UPDATE ON "CardCliente" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_produto_updated_at BEFORE UPDATE ON "Produto" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_item_card_updated_at BEFORE UPDATE ON "ItemCard" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forma_pagamento_updated_at BEFORE UPDATE ON "FormaPagamento" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fornecedor_updated_at BEFORE UPDATE ON "Fornecedor" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categoria_saida_updated_at BEFORE UPDATE ON "CategoriaSaida" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_centro_custo_updated_at BEFORE UPDATE ON "CentroCusto" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNÇÃO PARA GERAR PRÓXIMO NÚMERO DE CARD
-- ============================================
CREATE OR REPLACE FUNCTION proximo_numero_card(p_point_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  proximo_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX("numeroCard"), 0) + 1
  INTO proximo_numero
  FROM "CardCliente"
  WHERE "pointId" = p_point_id;
  
  RETURN proximo_numero;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMENTÁRIOS NAS TABELAS
-- ============================================
COMMENT ON TABLE "CardCliente" IS 'Cards de atendimento de clientes (mesas/comandas)';
COMMENT ON TABLE "Produto" IS 'Produtos vendidos na copa/bar';
COMMENT ON TABLE "ItemCard" IS 'Itens (produtos) adicionados aos cards';
COMMENT ON TABLE "FormaPagamento" IS 'Formas de pagamento disponíveis';
COMMENT ON TABLE "PagamentoCard" IS 'Pagamentos realizados nos cards';
COMMENT ON TABLE "Fornecedor" IS 'Fornecedores para saídas de caixa';
COMMENT ON TABLE "CategoriaSaida" IS 'Categorias para classificar saídas de caixa';
COMMENT ON TABLE "CentroCusto" IS 'Centros de custo para controle financeiro';
COMMENT ON TABLE "EntradaCaixa" IS 'Entradas manuais de caixa';
COMMENT ON TABLE "SaidaCaixa" IS 'Saídas manuais de caixa vinculadas a fornecedores, categorias e centro de custo';

