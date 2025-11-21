# Migration: Bloqueio de Agenda

Este documento descreve a migration para criar a tabela `BloqueioAgenda` no banco de dados PostgreSQL.

## Estrutura da Tabela

A tabela `BloqueioAgenda` armazena bloqueios de agenda para eventos, permitindo:
- Bloqueio geral (todas as quadras de um point) ou específico (quadras selecionadas)
- Bloqueio de dia inteiro ou por intervalo de horário
- Múltiplos bloqueios programados

## SQL de Migration

Execute o seguinte SQL no seu banco de dados PostgreSQL:

```sql
-- Criar tabela BloqueioAgenda
CREATE TABLE IF NOT EXISTS "BloqueioAgenda" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL,
  "quadraIds" JSONB, -- Array de IDs de quadras (null = todas as quadras)
  titulo TEXT NOT NULL,
  descricao TEXT,
  "dataInicio" TIMESTAMP NOT NULL,
  "dataFim" TIMESTAMP NOT NULL,
  "horaInicio" INTEGER, -- minutos desde 00:00 (null = dia inteiro)
  "horaFim" INTEGER, -- minutos desde 00:00 (null = dia inteiro)
  ativo BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_bloqueio_point FOREIGN KEY ("pointId") REFERENCES "Point"(id) ON DELETE CASCADE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_bloqueio_agenda_point_id ON "BloqueioAgenda"("pointId");
CREATE INDEX IF NOT EXISTS idx_bloqueio_agenda_data_inicio ON "BloqueioAgenda"("dataInicio");
CREATE INDEX IF NOT EXISTS idx_bloqueio_agenda_data_fim ON "BloqueioAgenda"("dataFim");
CREATE INDEX IF NOT EXISTS idx_bloqueio_agenda_ativo ON "BloqueioAgenda"(ativo);

-- Criar índice GIN para busca em quadraIds (JSONB)
CREATE INDEX IF NOT EXISTS idx_bloqueio_agenda_quadra_ids ON "BloqueioAgenda" USING GIN("quadraIds");

-- Criar trigger para atualizar updatedAt automaticamente
CREATE OR REPLACE FUNCTION update_bloqueio_agenda_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bloqueio_agenda_updated_at
BEFORE UPDATE ON "BloqueioAgenda"
FOR EACH ROW
EXECUTE FUNCTION update_bloqueio_agenda_updated_at();
```

## Como Executar

### Opção 1: Via SQL Editor (Recomendado)
1. Acesse o SQL Editor do seu banco de dados (Supabase, Neon, etc.)
2. Cole o SQL acima
3. Execute

### Opção 2: Via psql
```bash
psql $DATABASE_URL -f migration_bloqueio_agenda.sql
```

### Opção 3: Via Node.js (Script opcional)
Crie um arquivo `scripts/migrate-bloqueio-agenda.ts`:

```typescript
import { query } from '../src/lib/db';

const migrationSQL = `
  -- SQL acima aqui
`;

async function migrate() {
  try {
    await query(migrationSQL);
    console.log('Migration executada com sucesso!');
  } catch (error) {
    console.error('Erro na migration:', error);
  }
}

migrate();
```

## Estrutura dos Dados

### Exemplo: Bloqueio Geral (Todas as Quadras)
```json
{
  "pointId": "uuid-do-point",
  "quadraIds": null,
  "titulo": "Evento de Fim de Ano",
  "descricao": "Todas as quadras bloqueadas para evento",
  "dataInicio": "2024-12-31T00:00:00Z",
  "dataFim": "2024-12-31T23:59:59Z",
  "horaInicio": null,
  "horaFim": null,
  "ativo": true
}
```

### Exemplo: Bloqueio Específico com Horário
```json
{
  "pointId": "uuid-do-point",
  "quadraIds": ["uuid-quadra-1", "uuid-quadra-2"],
  "titulo": "Manutenção Preventiva",
  "descricao": "Quadras 1 e 2 em manutenção",
  "dataInicio": "2024-01-15T00:00:00Z",
  "dataFim": "2024-01-15T23:59:59Z",
  "horaInicio": 480,  // 08:00 (8 * 60)
  "horaFim": 1020,    // 17:00 (17 * 60)
  "ativo": true
}
```

## Validações

- `pointId` é obrigatório
- `quadraIds` pode ser `null` (todas as quadras) ou um array de IDs
- `dataInicio` deve ser anterior ou igual a `dataFim`
- Se `horaInicio` for fornecido, `horaFim` também deve ser
- Se `horaInicio` for `null`, significa bloqueio de dia inteiro

