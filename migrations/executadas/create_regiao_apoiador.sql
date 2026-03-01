CREATE TABLE IF NOT EXISTS "RegiaoApoiador" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "regiaoId" TEXT NOT NULL,
  "apoiadorId" UUID NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_regiaoapoiador_regiao FOREIGN KEY ("regiaoId") REFERENCES "Regiao"(id) ON DELETE CASCADE,
  CONSTRAINT fk_regiaoapoiador_apoiador FOREIGN KEY ("apoiadorId") REFERENCES "Apoiador"(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_regiaoapoiador_regiao_apoiador_unique ON "RegiaoApoiador"("regiaoId", "apoiadorId");
CREATE INDEX IF NOT EXISTS idx_regiaoapoiador_apoiador ON "RegiaoApoiador"("apoiadorId");
CREATE INDEX IF NOT EXISTS idx_regiaoapoiador_regiao ON "RegiaoApoiador"("regiaoId");
