-- Migration: Adicionar campo agendaOnlineAtivo na tabela Point
-- Permite habilitar/desabilitar a agenda online para cada estabelecimento

ALTER TABLE "Point" 
  ADD COLUMN IF NOT EXISTS "agendaOnlineAtivo" BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN "Point"."agendaOnlineAtivo" IS 'Flag que indica se a agenda online está habilitada para este estabelecimento. Quando ativo, a arena aparece disponível para novo agendamento no appatleta.';

