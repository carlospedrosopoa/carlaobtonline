-- Migração: Remover constraint de unicidade de AtletaCompeticao
-- Necessário para suportar round-robin onde cada atleta tem múltiplas parcerias

BEGIN;

-- Remover a constraint de unicidade
ALTER TABLE "AtletaCompeticao" 
DROP CONSTRAINT IF EXISTS uk_atleta_competicao;

-- Adicionar um índice composto para performance (sem constraint de unicidade)
-- Isso permite múltiplos registros do mesmo atleta na mesma competição
CREATE INDEX IF NOT EXISTS idx_atleta_competicao_competicao_atleta 
ON "AtletaCompeticao"("competicaoId", "atletaId");

COMMIT;

