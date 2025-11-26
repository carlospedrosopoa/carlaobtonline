-- MIGRACAO_CARD_URL.sql
-- Adiciona a coluna "cardUrl" na tabela "Partida" para armazenar a URL do card gerado no GCS.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Partida' AND column_name = 'cardUrl') THEN
        ALTER TABLE "Partida"
        ADD COLUMN "cardUrl" TEXT DEFAULT NULL;
        
        RAISE NOTICE 'Coluna "cardUrl" adicionada à tabela "Partida".';
    ELSE
        RAISE NOTICE 'Coluna "cardUrl" já existe na tabela "Partida". Nenhuma alteração feita.';
    END IF;
END $$;

