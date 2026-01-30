-- Migration: Adicionar credenciais PagBank por arena (Point)
-- Descrição: Permite que cada arena tenha sua própria conta PagBank (token + ambiente + token webhook)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Point' AND column_name = 'pagBankToken'
  ) THEN
    ALTER TABLE "Point" ADD COLUMN "pagBankToken" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Point' AND column_name = 'pagBankEnv'
  ) THEN
    ALTER TABLE "Point" ADD COLUMN "pagBankEnv" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Point' AND column_name = 'pagBankWebhookToken'
  ) THEN
    ALTER TABLE "Point" ADD COLUMN "pagBankWebhookToken" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Point' AND column_name = 'pagBankAtivo'
  ) THEN
    ALTER TABLE "Point" ADD COLUMN "pagBankAtivo" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN "Point"."pagBankToken" IS 'Token Bearer do PagBank para esta arena';
COMMENT ON COLUMN "Point"."pagBankEnv" IS 'Ambiente do PagBank (sandbox|production) para esta arena';
COMMENT ON COLUMN "Point"."pagBankWebhookToken" IS 'Token opcional para proteger webhook PagBank por arena';
COMMENT ON COLUMN "Point"."pagBankAtivo" IS 'Flag para habilitar PagBank nesta arena';
