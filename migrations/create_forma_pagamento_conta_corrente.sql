-- Migration: Criar forma de pagamento "Conta Corrente" para todas as arenas
-- Esta forma de pagamento permite que pagamentos sejam lançados como débito na conta corrente

-- Inserir forma de pagamento "Conta Corrente" para cada arena existente
INSERT INTO "FormaPagamento" (id, "pointId", nome, descricao, tipo, ativo, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  p.id,
  'Conta Corrente',
  'Pagamento via conta corrente do cliente. O valor será lançado como débito na conta corrente.',
  'OUTRO',
  true,
  NOW(),
  NOW()
FROM "Point" p
WHERE NOT EXISTS (
  SELECT 1 FROM "FormaPagamento" fp 
  WHERE fp."pointId" = p.id 
  AND LOWER(fp.nome) LIKE '%conta corrente%'
);

COMMENT ON TABLE "FormaPagamento" IS 'Formas de pagamento disponíveis. A forma "Conta Corrente" lança débitos na conta corrente em vez de movimentar o caixa.';

