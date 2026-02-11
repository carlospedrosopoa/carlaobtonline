CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Atleta"
ADD COLUMN IF NOT EXISTS "faceDescriptor" vector(128);

ALTER TABLE "Atleta"
ADD COLUMN IF NOT EXISTS "faceDescriptorModelVersion" text;

WITH src AS (
  SELECT
    a.id,
    '[' || string_agg(t.val, ',' ORDER BY t.ord) || ']' AS vec,
    a."faceEmbeddingModelVersion" AS mv
  FROM "Atleta" a
  CROSS JOIN LATERAL jsonb_array_elements_text(a."faceEmbedding") WITH ORDINALITY AS t(val, ord)
  WHERE a."faceDescriptor" IS NULL
    AND a."faceEmbedding" IS NOT NULL
    AND jsonb_typeof(a."faceEmbedding") = 'array'
  GROUP BY a.id, a."faceEmbeddingModelVersion"
  HAVING count(*) = 128
)
UPDATE "Atleta" a
SET
  "faceDescriptor" = src.vec::vector,
  "faceDescriptorModelVersion" = COALESCE(a."faceDescriptorModelVersion", src.mv),
  "updatedAt" = NOW()
FROM src
WHERE a.id = src.id
  AND a."faceDescriptor" IS NULL;

