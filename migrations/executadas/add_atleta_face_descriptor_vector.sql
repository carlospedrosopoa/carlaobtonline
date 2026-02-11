CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Atleta"
ADD COLUMN IF NOT EXISTS "faceDescriptor" vector(128);

ALTER TABLE "Atleta"
ADD COLUMN IF NOT EXISTS "faceDescriptorModelVersion" text;

CREATE INDEX IF NOT EXISTS "Atleta_faceDescriptor_ivfflat_idx"
ON "Atleta"
USING ivfflat ("faceDescriptor" vector_cosine_ops)
WITH (lists = 100)
WHERE "faceDescriptor" IS NOT NULL;

