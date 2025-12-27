-- Migration: Adicionar flag para atleta aceitar receber lembretes de agendamento
-- Data: 2024

-- Adicionar coluna para indicar se o atleta aceita receber lembretes
-- Por padrão é false (não aceita)
ALTER TABLE "Atleta" 
ADD COLUMN IF NOT EXISTS "aceitaLembretesAgendamento" BOOLEAN DEFAULT false;

-- Comentário na coluna para documentação
COMMENT ON COLUMN "Atleta"."aceitaLembretesAgendamento" IS 'Indica se o atleta aceita receber lembretes de agendamento via WhatsApp. Por padrão é false (não aceita)';

-- Criar índice para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_atleta_aceita_lembretes 
ON "Atleta"("aceitaLembretesAgendamento") 
WHERE "aceitaLembretesAgendamento" = true;

