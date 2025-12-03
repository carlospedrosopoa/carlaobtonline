-- Script SEGURO para limpar Cards de Clientes e Movimentações do Caixa
-- Este script permite escolher quais dados deletar e inclui verificações

-- ============================================
-- OPÇÃO 1: Limpar TUDO (Cards + Caixa)
-- ============================================
-- Descomente as linhas abaixo para executar:

/*
BEGIN;

-- 1. Deletar pagamentos vinculados a itens
DELETE FROM "PagamentoItem";

-- 2. Deletar pagamentos de cards
DELETE FROM "PagamentoCard";

-- 3. Deletar agendamentos vinculados a cards (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CardAgendamento') THEN
        DELETE FROM "CardAgendamento";
    END IF;
END $$;

-- 4. Deletar itens de cards
DELETE FROM "ItemCard";

-- 5. Deletar cards de clientes
DELETE FROM "CardCliente";

-- 6. Deletar entradas de caixa
DELETE FROM "EntradaCaixa";

-- 7. Deletar saídas de caixa
DELETE FROM "SaidaCaixa";

-- 8. Deletar aberturas de caixa
DELETE FROM "AberturaCaixa";

COMMIT;
*/

-- ============================================
-- OPÇÃO 2: Limpar apenas CARDS (mantém caixa)
-- ============================================
-- Descomente as linhas abaixo para executar:

/*
BEGIN;

DELETE FROM "PagamentoItem";
DELETE FROM "PagamentoCard";
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CardAgendamento') THEN
        DELETE FROM "CardAgendamento";
    END IF;
END $$;
DELETE FROM "ItemCard";
DELETE FROM "CardCliente";

COMMIT;
*/

-- ============================================
-- OPÇÃO 3: Limpar apenas CAIXA (mantém cards)
-- ============================================
-- Descomente as linhas abaixo para executar:

/*
BEGIN;

DELETE FROM "EntradaCaixa";
DELETE FROM "SaidaCaixa";
DELETE FROM "AberturaCaixa";

COMMIT;
*/

-- ============================================
-- OPÇÃO 4: Limpar por PointId específico
-- ============================================
-- Substitua 'SEU_POINT_ID_AQUI' pelo ID do point desejado

/*
BEGIN;

-- Cards e pagamentos de um point específico
DELETE FROM "PagamentoItem" 
WHERE "pagamentoCardId" IN (
    SELECT p.id FROM "PagamentoCard" p
    INNER JOIN "CardCliente" c ON p."cardId" = c.id
    WHERE c."pointId" = 'SEU_POINT_ID_AQUI'
);

DELETE FROM "PagamentoCard" 
WHERE "cardId" IN (
    SELECT id FROM "CardCliente" WHERE "pointId" = 'SEU_POINT_ID_AQUI'
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CardAgendamento') THEN
        DELETE FROM "CardAgendamento" 
        WHERE "cardId" IN (
            SELECT id FROM "CardCliente" WHERE "pointId" = 'SEU_POINT_ID_AQUI'
        );
    END IF;
END $$;

DELETE FROM "ItemCard" 
WHERE "cardId" IN (
    SELECT id FROM "CardCliente" WHERE "pointId" = 'SEU_POINT_ID_AQUI'
);

DELETE FROM "CardCliente" 
WHERE "pointId" = 'SEU_POINT_ID_AQUI';

-- Caixa de um point específico
DELETE FROM "EntradaCaixa" 
WHERE "pointId" = 'SEU_POINT_ID_AQUI';

DELETE FROM "SaidaCaixa" 
WHERE "pointId" = 'SEU_POINT_ID_AQUI';

DELETE FROM "AberturaCaixa" 
WHERE "pointId" = 'SEU_POINT_ID_AQUI';

COMMIT;
*/

-- ============================================
-- VERIFICAÇÃO ANTES DE DELETAR
-- ============================================
-- Execute este SELECT para ver quantos registros serão deletados:

SELECT 
    'Cards de Clientes' as tabela,
    COUNT(*) as total_registros
FROM "CardCliente"
UNION ALL
SELECT 
    'Itens de Cards',
    COUNT(*)
FROM "ItemCard"
UNION ALL
SELECT 
    'Pagamentos de Cards',
    COUNT(*)
FROM "PagamentoCard"
UNION ALL
SELECT 
    'Pagamentos Itens',
    COUNT(*)
FROM "PagamentoItem"
UNION ALL
SELECT 
    'Entradas de Caixa',
    COUNT(*)
FROM "EntradaCaixa"
UNION ALL
SELECT 
    'Saídas de Caixa',
    COUNT(*)
FROM "SaidaCaixa"
UNION ALL
SELECT 
    'Aberturas de Caixa',
    COUNT(*)
FROM "AberturaCaixa";

-- ============================================
-- VERIFICAÇÃO APÓS DELETAR
-- ============================================
-- Execute este SELECT após a limpeza para confirmar:

SELECT 
    (SELECT COUNT(*) FROM "CardCliente") as cards_restantes,
    (SELECT COUNT(*) FROM "ItemCard") as itens_restantes,
    (SELECT COUNT(*) FROM "PagamentoCard") as pagamentos_restantes,
    (SELECT COUNT(*) FROM "PagamentoItem") as pagamentos_itens_restantes,
    (SELECT COUNT(*) FROM "EntradaCaixa") as entradas_restantes,
    (SELECT COUNT(*) FROM "SaidaCaixa") as saidas_restantes,
    (SELECT COUNT(*) FROM "AberturaCaixa") as aberturas_restantes;

