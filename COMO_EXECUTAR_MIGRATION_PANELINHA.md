# Como Executar a Migration de Panelinhas

## Problema

Se você está recebendo erro 500 ao acessar "Minha Panelinha", provavelmente as tabelas ainda não foram criadas no banco de dados.

## Solução: Executar a Migration

### Opção 1: Via psql (Linha de Comando)

```bash
# Conecte-se ao banco de dados
psql -U seu_usuario -d seu_banco -h seu_host

# Execute a migration
\i migrations/create_panelinha.sql

# Ou execute diretamente:
psql -U seu_usuario -d seu_banco -h seu_host -f migrations/create_panelinha.sql
```

### Opção 2: Via Cliente SQL (pgAdmin, DBeaver, etc.)

1. Abra seu cliente SQL favorito
2. Conecte-se ao banco de dados
3. Abra o arquivo `migrations/create_panelinha.sql`
4. Execute o script completo

### Opção 3: Via Vercel (se usar Vercel Postgres)

1. Acesse o dashboard do Vercel
2. Vá em **Storage** → **Postgres**
3. Clique no seu banco de dados
4. Vá em **Data** → **SQL Editor**
5. Cole o conteúdo do arquivo `migrations/create_panelinha.sql`
6. Execute

### Opção 4: Via Supabase (se usar Supabase)

1. Acesse o dashboard do Supabase
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `migrations/create_panelinha.sql`
4. Execute

## Verificar se Funcionou

Após executar a migration, você pode verificar se as tabelas foram criadas:

```sql
-- Verificar se a tabela Panelinha existe
SELECT * FROM "Panelinha" LIMIT 1;

-- Verificar se a tabela PanelinhaAtleta existe
SELECT * FROM "PanelinhaAtleta" LIMIT 1;
```

Se não der erro, as tabelas foram criadas com sucesso!

## Arquivo da Migration

O arquivo está localizado em:
```
C:\carlao-dev\carlaobtonline\migrations\create_panelinha.sql
```

## Próximos Passos

Após executar a migration:
1. Recarregue a página "Minha Panelinha" no app
2. O erro 500 deve desaparecer
3. Você poderá criar sua primeira panelinha

