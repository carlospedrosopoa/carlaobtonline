-- Script para limpar Cards de Clientes e Movimentações do Caixa
-- ATENÇÃO: Este script irá DELETAR TODOS os dados relacionados a cards e caixa
-- Execute apenas se tiver certeza!

BEGIN;

-- 1. Deletar pagamentos vinculados a itens (PagamentoItem)
DELETE FROM "PagamentoItem";

-- 2. Deletar pagamentos de cards (PagamentoCard)
DELETE FROM "PagamentoCard";

-- 3. Deletar agendamentos vinculados a cards (CardAgendamento) - se a tabela existir
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CardAgendamento') THEN
        DELETE FROM "CardAgendamento";
    END IF;
END $$;

-- 4. Deletar itens de cards (ItemCard)
DELETE FROM "ItemCard";

-- 5. Deletar cards de clientes (CardCliente)
DELETE FROM "CardCliente";

-- 6. Deletar entradas de caixa (EntradaCaixa)
DELETE FROM "EntradaCaixa";

-- 7. Deletar saídas de caixa (SaidaCaixa)
DELETE FROM "SaidaCaixa";

-- 8. Deletar aberturas de caixa (AberturaCaixa)
DELETE FROM "AberturaCaixa";

-- 9. Resetar sequência de números de card (se existir)
DO $$
BEGIN
    -- Verificar se a função existe antes de tentar resetar
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'proximo_numero_card'
    ) THEN
        -- Resetar para cada pointId que tenha cards
        -- Como não sabemos quais pointIds existem, vamos resetar para 1 em todos
        -- Você pode ajustar isso conforme necessário
        PERFORM setval(
            pg_get_serial_sequence('"CardCliente"', 'numeroCard'),
            1,
            false
        );
    END IF;
END $$;

COMMIT;

-- Verificar se tudo foi deletado
SELECT 
    (SELECT COUNT(*) FROM "CardCliente") as cards_restantes,
    (SELECT COUNT(*) FROM "ItemCard") as itens_restantes,
    (SELECT COUNT(*) FROM "PagamentoCard") as pagamentos_restantes,
    (SELECT COUNT(*) FROM "EntradaCaixa") as entradas_restantes,
    (SELECT COUNT(*) FROM "SaidaCaixa") as saidas_restantes,
    (SELECT COUNT(*) FROM "AberturaCaixa") as aberturas_restantes;

