-- Migration: Tornar favorito de comanda global (sem usuarioId)
-- Data: 2026

-- Deduplicar por cardId mantendo o mais antigo
DELETE FROM "CardClienteFavorito" f
USING "CardClienteFavorito" f2
WHERE f."cardId" = f2."cardId"
  AND (
    f."createdAt" > f2."createdAt"
    OR (f."createdAt" = f2."createdAt" AND f.id > f2.id)
  );

-- Remover índice único antigo (por usuarioId+cardId), se existir
DROP INDEX IF EXISTS uk_card_cliente_favorito_usuario_card;

-- Remover coluna usuarioId, se existir
ALTER TABLE "CardClienteFavorito"
DROP COLUMN IF EXISTS "usuarioId";

-- Garantir único por cardId
CREATE UNIQUE INDEX IF NOT EXISTS uk_card_cliente_favorito_card
ON "CardClienteFavorito"("cardId");

