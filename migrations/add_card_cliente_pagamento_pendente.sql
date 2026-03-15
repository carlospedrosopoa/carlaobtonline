ALTER TABLE "CardCliente"
ADD COLUMN IF NOT EXISTS "pagamentoPendente" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "CardCliente"
ADD COLUMN IF NOT EXISTS "pagamentoPendenteAt" TIMESTAMP WITH TIME ZONE;

ALTER TABLE "CardCliente"
ADD COLUMN IF NOT EXISTS "pagamentoPendenteById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_CardCliente_pagamentoPendente" ON "CardCliente"("pagamentoPendente");
CREATE INDEX IF NOT EXISTS "idx_CardCliente_pagamentoPendenteById" ON "CardCliente"("pagamentoPendenteById");
