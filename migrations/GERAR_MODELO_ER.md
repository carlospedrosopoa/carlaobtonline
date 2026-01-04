# Como Gerar Modelo ER (Entity-Relationship) do Banco de Dados

## 🚀 Início Rápido - 3 Opções Mais Fáceis

### ⭐ Opção A: DBeaver (Mais Completa - Recomendada)
1. Baixe: https://dbeaver.io/download/
2. Instale e conecte ao banco Neon
3. Botão direito no banco → **View Diagram**
4. Exporte: File → Export Diagram → PNG/PDF

### ⭐ Opção B: dbdiagram.io (Mais Rápida - Online)
1. Acesse: https://dbdiagram.io/
2. Use o arquivo `schema_only.sql` que já temos
3. Cole no editor ou importe
4. Diagrama gerado automaticamente

### ⭐ Opção C: pgAdmin (Se já tem PostgreSQL)
1. Abra pgAdmin
2. Conecte ao banco
3. Botão direito no banco → **Generate ERD**

---

## Detalhes de Cada Opção

## Opção 1: dbdiagram.io (Recomendado - Gratuito e Online) ⭐

### Passo 1: Gerar arquivo .dbml a partir do PostgreSQL

Instale a ferramenta `dbml` (Node.js):

```bash
npm install -g @dbml/cli
```

Gere o arquivo DBML:

```bash
# Se tiver pg_dump instalado
pg_dump --schema-only "postgresql://usuario:senha@host/database?sslmode=require" | dbml2dbml -f postgres -t dbml > schema.dbml

# Ou use o arquivo schema_only.sql que já temos
dbml2dbml -f postgres -t dbml schema_only.sql > schema.dbml
```

### Passo 2: Visualizar no dbdiagram.io

1. Acesse: https://dbdiagram.io/
2. Cole o conteúdo do arquivo `.dbml` ou importe o arquivo
3. O diagrama será gerado automaticamente
4. Você pode exportar como PNG, PDF ou compartilhar o link

**Vantagens:**
- ✅ Gratuito
- ✅ Interface visual bonita
- ✅ Exporta para PNG/PDF
- ✅ Compartilhamento online
- ✅ Edição colaborativa

## Opção 2: pgAdmin (Ferramenta Nativa PostgreSQL)

Se você tem PostgreSQL instalado:

1. Abra o **pgAdmin**
2. Conecte-se ao banco de dados
3. Clique com botão direito no banco → **Generate ERD**
4. Selecione as tabelas desejadas
5. O diagrama será gerado automaticamente

**Vantagens:**
- ✅ Já vem com PostgreSQL
- ✅ Integrado com o banco
- ✅ Exporta para PNG/PDF

## Opção 3: DBeaver (Gratuito e Completo) ⭐⭐

### Instalação

1. Baixe: https://dbeaver.io/download/
2. Instale e abra o DBeaver
3. Conecte-se ao banco Neon

### Gerar ERD

1. Clique com botão direito no banco → **View Diagram**
2. Ou vá em: **Database** → **View Diagram**
3. Selecione as tabelas
4. O diagrama será gerado
5. Exporte: **File** → **Export Diagram** → PNG/PDF/SVG

**Vantagens:**
- ✅ Gratuito e open-source
- ✅ Muito completo (editor SQL, ERD, etc.)
- ✅ Suporta múltiplos bancos
- ✅ Exporta em vários formatos
- ✅ Interface profissional

## Opção 4: ERDPlus (Online e Gratuito)

1. Acesse: https://erdplus.com/
2. Crie uma conta gratuita
3. **Import Database** → Selecione PostgreSQL
4. Cole a connection string ou importe o schema
5. O diagrama será gerado

**Vantagens:**
- ✅ Online (não precisa instalar)
- ✅ Gratuito
- ✅ Interface simples

## Opção 5: SchemaSpy (Geração Automática de Documentação)

### Instalação

```bash
# Requer Java
# Baixe: https://github.com/schemaspy/schemaspy/releases
```

### Executar

```bash
java -jar schemaspy.jar \
  -t pgsql \
  -host ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech \
  -port 5432 \
  -db neondb \
  -u neondb_owner \
  -p senha \
  -o output \
  -s public
```

Isso gera uma documentação HTML completa com diagramas ER.

**Vantagens:**
- ✅ Gera documentação completa
- ✅ Diagramas interativos
- ✅ Gratuito
- ✅ Open-source

## Opção 6: PostgreSQL Autodoc (Geração de Documentação)

```bash
# Instalar
pip install postgresql-autodoc

# Gerar
postgresql_autodoc -d neondb -h host -u usuario -p senha -f output
```

## Opção 7: Usar SQL para Gerar DBML Manualmente

Você pode criar um script que gera DBML a partir do schema:

```sql
-- Script para listar tabelas e relacionamentos
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

## Opção 8: Draw.io / diagrams.net (Manual)

1. Acesse: https://app.diagrams.net/
2. Crie um novo diagrama
3. Use a biblioteca de formas de banco de dados
4. Desenhe manualmente baseado no schema

**Vantagens:**
- ✅ Controle total sobre o design
- ✅ Gratuito
- ✅ Integração com Google Drive/GitHub

## Recomendações por Caso de Uso

### Para Documentação Rápida
→ **dbdiagram.io** ou **DBeaver**

### Para Documentação Profissional
→ **SchemaSpy** ou **DBeaver**

### Para Edição e Colaboração
→ **dbdiagram.io** ou **Draw.io**

### Para Análise Detalhada
→ **DBeaver** ou **pgAdmin**

## Script PowerShell para Gerar DBML (Automático)

Criei um script que pode ajudar a gerar DBML a partir do schema_only.sql:

```powershell
# Ver: migrations/generate_dbml.ps1 (se criarmos)
```

## Exemplo de Uso com DBeaver (Mais Fácil)

1. **Instale DBeaver**: https://dbeaver.io/download/
2. **Crie nova conexão**:
   - Database: PostgreSQL
   - Host: `ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech`
   - Port: `5432`
   - Database: `neondb`
   - Username: `neondb_owner`
   - Password: `npg_2hKQRuaCV8sZ`
   - SSL: Required
3. **Conecte-se**
4. **Gere ERD**: Botão direito no banco → **View Diagram**
5. **Exporte**: File → Export Diagram → PNG/PDF

## Links Úteis

- **dbdiagram.io**: https://dbdiagram.io/
- **DBeaver**: https://dbeaver.io/
- **SchemaSpy**: https://github.com/schemaspy/schemaspy
- **ERDPlus**: https://erdplus.com/
- **Draw.io**: https://app.diagrams.net/

