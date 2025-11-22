# Migration: WhatsApp do Gestor

Este documento descreve a migration para adicionar o campo `whatsapp` na tabela `User` para armazenar o número do WhatsApp do gestor.

## Estrutura da Migration

A migration adiciona um campo `whatsapp` na tabela `User` para armazenar o número do WhatsApp do gestor (formato: apenas números, ex: 5511999999999).

## SQL de Migration

Execute o seguinte SQL no seu banco de dados PostgreSQL:

```sql
-- Adicionar coluna whatsapp na tabela User
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Criar índice para busca rápida (opcional)
CREATE INDEX IF NOT EXISTS idx_user_whatsapp ON "User"(whatsapp) WHERE whatsapp IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN "User".whatsapp IS 'Número do WhatsApp do gestor (apenas números, ex: 5511999999999)';
```

## Como Executar

### Opção 1: Via SQL Editor (Recomendado)
1. Acesse o SQL Editor do seu banco de dados (Supabase, Neon, etc.)
2. Cole o SQL acima
3. Execute

### Opção 2: Via psql
```bash
psql $DATABASE_URL -f migration_whatsapp_gestor.sql
```

## Formato do Número

O número deve ser armazenado no formato internacional sem caracteres especiais:
- Exemplo: `5511999999999` (Brasil: 55 + DDD + número)
- Sem espaços, parênteses, hífens ou outros caracteres
- Apenas números

## Uso

Este campo será usado para:
- Enviar notificações sobre novos agendamentos
- Enviar confirmações de agendamento
- Enviar lembretes de agendamentos
- Enviar informações sobre cancelamentos

