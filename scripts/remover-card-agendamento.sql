-- Script para remover a funcionalidade de agendamentos vinculados a cards
-- Este script remove todos os dados e a tabela CardAgendamento
-- ATENÇÃO: Esta operação é irreversível!

-- 1. Verificar se a tabela existe e mostrar informações
DO $$
DECLARE
    table_exists BOOLEAN;
    record_count INTEGER;
BEGIN
    -- Verificar se a tabela existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'CardAgendamento'
    ) INTO table_exists;

    IF table_exists THEN
        -- Contar registros antes de deletar
        SELECT COUNT(*) INTO record_count FROM "CardAgendamento";
        
        RAISE NOTICE 'Tabela CardAgendamento encontrada com % registros', record_count;
        
        -- Deletar todos os registros
        DELETE FROM "CardAgendamento";
        
        RAISE NOTICE 'Todos os registros foram removidos da tabela CardAgendamento';
    ELSE
        RAISE NOTICE 'Tabela CardAgendamento não existe no banco de dados';
    END IF;
END $$;

-- 2. Remover índices relacionados (se existirem)
DROP INDEX IF EXISTS idx_card_agendamento_card_id;
DROP INDEX IF EXISTS idx_card_agendamento_agendamento_id;

-- 3. Remover a tabela CardAgendamento
-- Descomente a linha abaixo se desejar remover completamente a tabela
-- DROP TABLE IF EXISTS "CardAgendamento" CASCADE;

-- 4. Verificar se ainda existem referências à tabela em outras partes do código
-- (Isso é apenas informativo - as referências no código já foram removidas)

-- NOTA: Se você descomentou a linha DROP TABLE acima, a tabela será completamente removida.
-- Se você deixou comentado, apenas os dados foram removidos, mas a estrutura da tabela permanece.
-- Recomendamos descomentar a linha DROP TABLE para uma limpeza completa.

