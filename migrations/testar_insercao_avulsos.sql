-- Script para testar a inserção de participantes avulsos
-- Execute este script para verificar se os campos existem e se a inserção funciona

-- 1. Verificar se as colunas existem
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'AgendamentoAtleta' 
  AND column_name IN ('nomeAvulso', 'telefoneAvulso', 'createdById', 'createdBy')
ORDER BY column_name;

-- 2. Verificar constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'AgendamentoAtleta'
  AND constraint_type IN ('UNIQUE', 'CHECK')
ORDER BY constraint_name;

-- 3. Testar inserção de participante avulso (substitua 'AGENDAMENTO_ID' e 'USER_ID' pelos valores reais)
-- Descomente e ajuste os valores abaixo para testar:
/*
INSERT INTO "AgendamentoAtleta" ("agendamentoId", "atletaId", "nomeAvulso", "telefoneAvulso", "createdById", "createdAt")
VALUES ('AGENDAMENTO_ID', NULL, 'Teste Avulso', NULL, 'USER_ID', NOW())
RETURNING id, "agendamentoId", "atletaId", "nomeAvulso", "telefoneAvulso";

-- Verificar se foi inserido
SELECT * FROM "AgendamentoAtleta" WHERE "nomeAvulso" = 'Teste Avulso';

-- Limpar teste (descomente para limpar)
-- DELETE FROM "AgendamentoAtleta" WHERE "nomeAvulso" = 'Teste Avulso';
*/

