-- Migration: Adicionar configurações de lembretes de agendamento na tabela Point
-- Data: 2024

-- Adicionar coluna para habilitar/desabilitar envio de lembretes
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS "enviarLembretesAgendamento" BOOLEAN DEFAULT false;

-- Adicionar coluna para definir antecedência do lembrete em horas
-- Exemplos: 8 (8 horas antes), 24 (24 horas antes), etc.
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS "antecedenciaLembrete" INTEGER DEFAULT 8;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN "Point"."enviarLembretesAgendamento" IS 'Indica se o gestor da arena quer enviar lembretes de agendamento para os atletas';
COMMENT ON COLUMN "Point"."antecedenciaLembrete" IS 'Antecedência em horas para envio do lembrete (ex: 8 = 8 horas antes, 24 = 24 horas antes)';

-- Criar índice para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_point_lembretes_agendamento 
ON "Point"("enviarLembretesAgendamento", "antecedenciaLembrete") 
WHERE "enviarLembretesAgendamento" = true;

