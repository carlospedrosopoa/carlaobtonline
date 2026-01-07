-- Script para verificar se a migração de participantes avulsos foi executada
-- Execute este script para verificar se os campos existem na tabela AgendamentoAtleta

-- Verificar se as colunas existem
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'AgendamentoAtleta' 
  AND column_name IN ('nomeAvulso', 'telefoneAvulso')
ORDER BY column_name;

-- Se retornar 2 linhas, a migração foi executada com sucesso
-- Se retornar 0 linhas, execute a migração: migrations/add_participantes_avulsos_agendamento.sql

-- Verificar se há participantes avulsos cadastrados
SELECT 
    COUNT(*) as total_participantes_avulsos
FROM "AgendamentoAtleta"
WHERE "atletaId" IS NULL AND "nomeAvulso" IS NOT NULL;

