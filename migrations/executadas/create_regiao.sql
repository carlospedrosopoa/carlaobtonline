DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'postgis extension not available (insufficient_privilege)';
    WHEN undefined_file THEN
      RAISE NOTICE 'postgis extension not available (undefined_file)';
  END;
END $$;

CREATE TABLE IF NOT EXISTS "Regiao" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  "limiteGeojson" JSONB NOT NULL,
  "centroLat" DOUBLE PRECISION,
  "centroLng" DOUBLE PRECISION,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_regiao_nome_unique ON "Regiao"(LOWER(nome));

CREATE TABLE IF NOT EXISTS "RegiaoPoint" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "regiaoId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_regiaopoint_regiao FOREIGN KEY ("regiaoId") REFERENCES "Regiao"(id) ON DELETE CASCADE,
  CONSTRAINT fk_regiaopoint_point FOREIGN KEY ("pointId") REFERENCES "Point"(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_regiaopoint_regiao_point_unique ON "RegiaoPoint"("regiaoId", "pointId");
CREATE INDEX IF NOT EXISTS idx_regiaopoint_point ON "RegiaoPoint"("pointId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE 'ALTER TABLE "Regiao" ADD COLUMN IF NOT EXISTS limite geometry(MultiPolygon, 4326)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_regiao_limite_gist ON "Regiao" USING GIST (limite)';
  END IF;
END $$;
