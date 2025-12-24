# Migration: Módulo de Professores

Este documento descreve a migration para criar o módulo completo de professores e aulas.

## 📋 Arquivo de Migration

- **Arquivo**: `migrations/create_modulo_professor.sql`
- **Data**: 2024-12

## 🔧 O que esta migration faz

### 1. Adiciona Role PROFESSOR
- Adiciona `PROFESSOR` ao enum `Role` existente (se ainda não existir)

### 2. Adiciona Recorrência ao Agendamento
- Adiciona campos `recorrenciaId` e `recorrenciaConfig` na tabela `Agendamento`
- Cria índice para busca por recorrência

### 3. Cria Novos Enums
- `TipoAula`: INDIVIDUAL, GRUPO, TURMA
- `NivelAula`: INICIANTE, INTERMEDIARIO, AVANCADO
- `StatusAula`: AGENDADA, CONFIRMADA, EM_ANDAMENTO, CONCLUIDA, CANCELADA, ADIADA
- `StatusInscricao`: CONFIRMADO, AGUARDANDO, CANCELADO, FALTOU

### 4. Cria Novas Tabelas

#### Professor
- Perfil profissional vinculado a um User (1:1)
- Campos: especialidade, bio, valorHora, telefoneProfissional, emailProfissional, ativo, aceitaNovosAlunos

#### Aula
- Aula vinculada a um Agendamento (1:1)
- Campos: titulo, descricao, tipoAula, nivel, maxAlunos, valores, status, datas, recorrência

#### AlunoAula
- Relação entre Atleta e Aula com dados específicos
- Campos: statusInscricao, presenca, valores financeiros, observações
- Unique constraint: (aulaId, atletaId)

#### AlunoProfessor
- Relação muitos-para-muitos entre Professor e Atleta
- Campos: nivel, observacoes, ativo, datas
- Unique constraint: (professorId, atletaId)

#### AvaliacaoAluno
- Avaliações que o professor faz sobre alunos
- Campos: nota, comentario, pontos positivos/melhorar, notas por categoria
- Unique constraint: (aulaId, atletaId)

### 5. Índices
- Índices para performance em buscas frequentes
- Índices compostos para queries complexas

### 6. Triggers
- Trigger para atualizar `updatedAt` automaticamente em todas as tabelas

## 🚀 Como Executar

### Opção 1: Via Script Node.js

Crie um arquivo `scripts/run-migration-professor.js` (seguindo o padrão dos outros):

```javascript
// scripts/run-migration-professor.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/create_modulo_professor.sql'),
      'utf8'
    );
    
    console.log('Executando migration do módulo de professores...');
    await client.query(migrationSQL);
    console.log('✅ Migration executada com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
```

Execute:
```bash
node scripts/run-migration-professor.js
```

### Opção 2: Via psql direto

```bash
psql $DATABASE_URL -f migrations/create_modulo_professor.sql
```

### Opção 3: Via cliente PostgreSQL

Abra o arquivo `migrations/create_modulo_professor.sql` no seu cliente PostgreSQL favorito e execute.

## ✅ Verificação

Após executar a migration, verifique se as tabelas foram criadas:

```sql
-- Verificar se as tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Professor', 'Aula', 'AlunoAula', 'AlunoProfessor', 'AvaliacaoAluno');

-- Verificar se os enums foram criados
SELECT typname 
FROM pg_type 
WHERE typname IN ('TipoAula', 'NivelAula', 'StatusAula', 'StatusInscricao');

-- Verificar se o role PROFESSOR foi adicionado
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role');
```

## ⚠️ Notas Importantes

1. **Idempotência**: A migration usa `IF NOT EXISTS` e `IF EXISTS` para ser idempotente (pode ser executada múltiplas vezes sem erro)

2. **Role PROFESSOR**: Se o enum Role não existir, será necessário criá-lo primeiro. A migration assume que o enum já existe (já que é usado no modelo User)

3. **Agendamento**: A migration adiciona campos de recorrência ao Agendamento se ainda não existirem (compatibilidade com sistemas que já têm recorrência implementada)

4. **Foreign Keys**: Todas as foreign keys usam `ON DELETE CASCADE` para manter a integridade referencial

5. **Timestamps**: Todas as tabelas têm `createdAt` e `updatedAt` com timezone

## 🔄 Rollback (se necessário)

Para reverter esta migration, execute:

```sql
-- Remover triggers
DROP TRIGGER IF EXISTS update_professor_updated_at ON "Professor";
DROP TRIGGER IF EXISTS update_aula_updated_at ON "Aula";
DROP TRIGGER IF EXISTS update_aluno_aula_updated_at ON "AlunoAula";
DROP TRIGGER IF EXISTS update_aluno_professor_updated_at ON "AlunoProfessor";
DROP TRIGGER IF EXISTS update_avaliacao_aluno_updated_at ON "AvaliacaoAluno";

-- Remover tabelas (em ordem devido às foreign keys)
DROP TABLE IF EXISTS "AvaliacaoAluno";
DROP TABLE IF EXISTS "AlunoAula";
DROP TABLE IF EXISTS "AlunoProfessor";
DROP TABLE IF EXISTS "Aula";
DROP TABLE IF EXISTS "Professor";

-- Remover enums (opcional - só se não forem usados em outro lugar)
-- DROP TYPE IF EXISTS "StatusInscricao";
-- DROP TYPE IF EXISTS "StatusAula";
-- DROP TYPE IF EXISTS "NivelAula";
-- DROP TYPE IF EXISTS "TipoAula";

-- Remover campos de recorrência do Agendamento (opcional)
-- ALTER TABLE "Agendamento" DROP COLUMN IF EXISTS "recorrenciaConfig";
-- ALTER TABLE "Agendamento" DROP COLUMN IF EXISTS "recorrenciaId";
-- DROP INDEX IF EXISTS idx_agendamento_recorrencia_id;
```

## 📝 Próximos Passos

Após executar a migration:

1. Criar o serviço `professorService.ts` em `src/lib/`
2. Criar as rotas API em `src/app/api/professor/`
3. Criar tipos TypeScript em `src/types/professor.ts`
4. Implementar os controllers

