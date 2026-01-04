-- Script SQL para listar todas as relações (Foreign Keys) do banco
-- Útil para gerar modelo ER manualmente ou entender a estrutura

-- Listar todas as Foreign Keys com informações detalhadas
SELECT 
    tc.table_schema,
    tc.table_name AS tabela_origem,
    kcu.column_name AS coluna_origem,
    ccu.table_schema AS schema_destino,
    ccu.table_name AS tabela_destino,
    ccu.column_name AS coluna_destino,
    tc.constraint_name AS nome_constraint,
    rc.update_rule AS regra_update,
    rc.delete_rule AS regra_delete
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
  AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Listar todas as tabelas com número de colunas e relacionamentos
SELECT 
    t.table_name AS tabela,
    COUNT(DISTINCT c.column_name) AS num_colunas,
    COUNT(DISTINCT fk.constraint_name) AS num_foreign_keys_entrada,
    COUNT(DISTINCT fk2.constraint_name) AS num_foreign_keys_saida
FROM information_schema.tables t
LEFT JOIN information_schema.columns c 
  ON t.table_name = c.table_name 
  AND t.table_schema = c.table_schema
LEFT JOIN information_schema.table_constraints fk
  ON t.table_name = fk.table_name
  AND fk.constraint_type = 'FOREIGN KEY'
LEFT JOIN information_schema.key_column_usage fk2
  ON t.table_name = fk2.table_name
  AND fk2.table_schema = t.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- Listar colunas de todas as tabelas (útil para documentação)
SELECT 
    t.table_name AS tabela,
    c.column_name AS coluna,
    c.data_type AS tipo,
    c.character_maximum_length AS tamanho_max,
    c.is_nullable AS permite_null,
    c.column_default AS valor_padrao,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PK'
        WHEN fk.column_name IS NOT NULL THEN 'FK'
        ELSE ''
    END AS tipo_coluna
FROM information_schema.tables t
JOIN information_schema.columns c 
  ON t.table_name = c.table_name 
  AND t.table_schema = c.table_schema
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
      ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
) pk ON t.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
      ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
) fk ON t.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;


