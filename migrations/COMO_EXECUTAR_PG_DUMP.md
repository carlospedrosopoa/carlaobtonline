# Como Executar pg_dump no Windows

## Opção 1: Instalar PostgreSQL (Recomendado)

### Passo 1: Baixar e Instalar PostgreSQL

1. Acesse: https://www.postgresql.org/download/windows/
2. Baixe o instalador (ex: PostgreSQL 17)
3. Durante a instalação, **marque a opção "Command Line Tools"**
4. Anote o caminho de instalação (geralmente: `C:\Program Files\PostgreSQL\17\bin`)

### Passo 2: Adicionar ao PATH (Opcional mas Recomendado)

1. Abra "Variáveis de Ambiente" do Windows
2. Edite a variável `Path` do usuário
3. Adicione: `C:\Program Files\PostgreSQL\17\bin`
4. Reinicie o terminal/PowerShell

### Passo 3: Executar o Comando

Abra PowerShell ou CMD e execute:

```powershell
cd C:\carlao-dev\carlaobtonline

pg_dump --schema-only --no-owner --no-privileges `
  "postgresql://neondb_owner:npg_2hKQRuaCV8sZ@ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require" `
  > migrations\schema_only_novo.sql
```

**Nota:** No PowerShell, use crase (`` ` ``) para quebra de linha, ou coloque tudo em uma linha.

## Opção 2: Usar Caminho Completo (Sem Adicionar ao PATH)

Se você instalou o PostgreSQL mas não adicionou ao PATH:

```powershell
cd C:\carlao-dev\carlaobtonline

& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --schema-only --no-owner --no-privileges `
  "postgresql://neondb_owner:npg_2hKQRuaCV8sZ@ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require" `
  > migrations\schema_only_novo.sql
```

## Opção 3: Usar Docker (Sem Instalar PostgreSQL)

Se você tem Docker instalado:

```powershell
cd C:\carlao-dev\carlaobtonline

docker run --rm -v ${PWD}/migrations:/output postgres:17 `
  pg_dump --schema-only --no-owner --no-privileges `
  "postgresql://neondb_owner:npg_2hKQRuaCV8sZ@ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require" `
  > migrations\schema_only_novo.sql
```

## Opção 4: Usar o Script PowerShell Já Criado

Você já tem o dump completo, então pode usar o script que criamos:

```powershell
cd C:\carlao-dev\carlaobtonline
.\migrations\extract_schema_only.ps1 `
  -InputFile "c:\Users\carlos\dump-neondb-202601030553.sql" `
  -OutputFile "migrations\schema_only.sql"
```

Este script já foi executado e gerou o arquivo `migrations\schema_only.sql` ✅

## Opção 5: Usar Neon CLI (Se Disponível)

Se você tem o Neon CLI instalado:

```bash
neonctl db dump --schema-only --output migrations/schema_only.sql
```

## Verificação

Após executar, verifique se o arquivo foi criado:

```powershell
Get-Item migrations\schema_only.sql | Select-Object Name, Length, LastWriteTime
```

E confirme que não há dados:

```powershell
Select-String -Path migrations\schema_only.sql -Pattern "^COPY " | Measure-Object
# Deve retornar Count: 0
```

## Comando Completo (Uma Linha - PowerShell)

```powershell
pg_dump --schema-only --no-owner --no-privileges "postgresql://neondb_owner:npg_2hKQRuaCV8sZ@ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require" -f migrations\schema_only_novo.sql
```

**Nota:** No PowerShell, use `-f` ao invés de `>` para redirecionar para arquivo, ou use `Out-File`:

```powershell
pg_dump --schema-only --no-owner --no-privileges "postgresql://neondb_owner:npg_2hKQRuaCV8sZ@ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require" | Out-File -FilePath migrations\schema_only_novo.sql -Encoding utf8
```

## Problemas Comuns

### Erro: "pg_dump não é reconhecido"
- Instale o PostgreSQL ou adicione o bin ao PATH
- Ou use o caminho completo: `"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"`

### Erro: "could not connect to server"
- Verifique se a URL de conexão está correta
- Verifique se o banco permite conexões externas
- Teste a conexão primeiro: `psql "postgresql://..."`

### Erro de encoding no arquivo gerado
- Use `-f arquivo.sql` ao invés de `> arquivo.sql`
- Ou use `Out-File -Encoding utf8`




