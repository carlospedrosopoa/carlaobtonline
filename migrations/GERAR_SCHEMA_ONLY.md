# Como Gerar Script SQL Apenas com Estrutura

## Opção 1: Usar pg_dump (Mais Recomendado)

Execute diretamente no banco de produção:

```bash
pg_dump --schema-only --no-owner --no-privileges \
  "postgresql://usuario:senha@ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require" \
  > migrations/schema_only_completo.sql
```

## Opção 2: Processar o Dump Existente com PowerShell

Execute o script PowerShell fornecido:

```powershell
cd C:\carlao-dev\carlaobtonline
.\migrations\extract_schema_only.ps1 -InputFile "c:\Users\carlos\dump-neondb-202601030553.sql" -OutputFile "migrations\schema_only.sql"
```

Este script:
- ✅ Remove todos os blocos `COPY` (dados)
- ✅ Remove comandos `SELECT pg_catalog.setval` (valores de sequências)
- ✅ Mantém toda a estrutura: tipos, funções, tabelas, índices, constraints, triggers, views

## Opção 3: Processamento Manual

Se preferir fazer manualmente, remova do dump:

1. Todos os blocos que começam com `COPY public."NomeTabela"` até `\.`
2. Linhas com `SELECT pg_catalog.setval` que definem valores de sequências

## Verificação

Após gerar o script, verifique:

```sql
-- O script não deve conter:
-- COPY public."Tabela" ...
-- \.
-- SELECT pg_catalog.setval('...', X, true);

-- Deve conter apenas:
-- CREATE TYPE ...
-- CREATE FUNCTION ...
-- CREATE TABLE ...
-- CREATE INDEX ...
-- ALTER TABLE ... ADD CONSTRAINT ...
-- CREATE TRIGGER ...
-- CREATE VIEW ...
```

## Uso do Script Gerado

Para criar um novo banco apenas com estrutura:

```bash
psql "postgresql://usuario:senha@host/database?sslmode=require" -f migrations/schema_only.sql
```


