-- Script para normalizar telefones dos atletas
-- Remove todos os caracteres não numéricos dos telefones na tabela Atleta
-- Data: 2024

-- Verificar telefones antes da normalização (para auditoria)
SELECT 
    id,
    nome,
    fone as telefone_original,
    REGEXP_REPLACE(fone, '[^0-9]', '', 'g') as telefone_normalizado,
    LENGTH(fone) as tamanho_original,
    LENGTH(REGEXP_REPLACE(fone, '[^0-9]', '', 'g')) as tamanho_normalizado
FROM "Atleta"
WHERE fone IS NOT NULL
ORDER BY nome;

-- Normalizar telefones (remover caracteres não numéricos)
UPDATE "Atleta"
SET fone = REGEXP_REPLACE(fone, '[^0-9]', '', 'g')
WHERE fone IS NOT NULL
  AND fone != REGEXP_REPLACE(fone, '[^0-9]', '', 'g'); -- Apenas atualizar se houver mudança

-- Verificar resultado após normalização
SELECT 
    id,
    nome,
    fone as telefone_normalizado,
    LENGTH(fone) as tamanho
FROM "Atleta"
WHERE fone IS NOT NULL
ORDER BY nome;

-- Estatísticas
SELECT 
    COUNT(*) as total_atletas,
    COUNT(fone) as atletas_com_telefone,
    COUNT(*) - COUNT(fone) as atletas_sem_telefone,
    COUNT(CASE WHEN LENGTH(fone) < 10 THEN 1 END) as telefones_invalidos_curtos,
    COUNT(CASE WHEN LENGTH(fone) > 11 THEN 1 END) as telefones_invalidos_longos
FROM "Atleta";

