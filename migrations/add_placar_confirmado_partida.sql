-- Adicionar campos de confirmação de placar na tabela Partida
ALTER TABLE "Partida" 
  ADD COLUMN IF NOT EXISTS "placarConfirmado" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "placarConfirmadoPor" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "placarConfirmadoEm" TIMESTAMP;

COMMENT ON COLUMN "Partida"."placarConfirmado" IS 'Indica se o placar foi confirmado pelo criador da partida';
COMMENT ON COLUMN "Partida"."placarConfirmadoPor" IS 'ID do usuário que confirmou o placar (apenas o criador pode confirmar)';
COMMENT ON COLUMN "Partida"."placarConfirmadoEm" IS 'Data e hora em que o placar foi confirmado';

