-- Migration: Adicionar flag para usuário aceitar receber lembretes de agendamento
-- Data: 2024

-- Adicionar coluna para indicar se o usuário aceita receber lembretes
-- Por padrão é false (não aceita)
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "aceitaLembretesAgendamento" BOOLEAN DEFAULT false;

-- Comentário na coluna para documentação
COMMENT ON COLUMN "User"."aceitaLembretesAgendamento" IS 'Indica se o usuário aceita receber lembretes de agendamento via WhatsApp. Por padrão é false (não aceita). Admin pode ativar/desativar.';

-- Criar índice para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_user_aceita_lembretes 
ON "User"("aceitaLembretesAgendamento") 
WHERE "aceitaLembretesAgendamento" = true;

