-- Migração: Adicionar campos atleta3Id e atleta4Id à tabela JogoCompeticao
-- Estes campos armazenam os IDs dos atletas da segunda dupla diretamente

ALTER TABLE "JogoCompeticao" 
ADD COLUMN IF NOT EXISTS "atleta3Id" TEXT NULL,
ADD COLUMN IF NOT EXISTS "atleta4Id" TEXT NULL;

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_atleta3 ON "JogoCompeticao"("atleta3Id") WHERE "atleta3Id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_atleta4 ON "JogoCompeticao"("atleta4Id") WHERE "atleta4Id" IS NOT NULL;

