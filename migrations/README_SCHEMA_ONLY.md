# Como Criar Script SQL Apenas com Estrutura (Schema Only)

## Método 1: Usando pg_dump (Recomendado)

Execute o seguinte comando para gerar um script apenas com a estrutura:

```bash
pg_dump --schema-only --no-owner --no-privileges -h <host> -U <usuario> -d <database> > migrations/schema_only.sql
```

Para Neon especificamente:

```bash
pg_dump --schema-only --no-owner --no-privileges "postgresql://usuario:senha@host.neon.tech/database?sslmode=require" > migrations/schema_only.sql
```

**Parâmetros importantes:**
- `--schema-only`: Apenas estrutura, sem dados
- `--no-owner`: Remove comandos ALTER OWNER (útil para diferentes ambientes)
- `--no-privileges`: Remove comandos GRANT/REVOKE

## Método 2: Processar o Dump Existente ✅ (JÁ EXECUTADO)

Se você já tem um dump completo, pode remover os dados usando o script PowerShell fornecido:

```powershell
.\migrations\extract_schema_only.ps1 -InputFile "caminho\para\dump.sql" -OutputFile "migrations\schema_only.sql"
```

**Status:** ✅ O arquivo `schema_only.sql` já foi gerado com sucesso e está completo (5.168 linhas, sem dados).

O script remove automaticamente:
- Todos os blocos `COPY public."NomeTabela"` até `\.`
- Comandos `SELECT pg_catalog.setval` (valores de sequências)

E mantém:
- Todos os tipos ENUM
- Todas as funções
- Todas as tabelas e suas estruturas
- Todos os índices
- Todas as constraints e foreign keys
- Todos os triggers
- Todas as views

## Método 3: Script SQL Limpo

O arquivo `create_schema_only.sql` contém uma versão limpa e organizada de exemplo, mas está incompleto devido ao tamanho.

**✅ JÁ TEMOS O SCRIPT COMPLETO:** O arquivo `schema_only.sql` foi gerado com sucesso usando o Método 2 (processamento do dump existente) e está **completo e pronto para uso**. Este arquivo contém toda a estrutura do banco sem dados.

Para gerar um novo script completo, use o Método 1 (pg_dump) ou o Método 2 (processar dump existente).

