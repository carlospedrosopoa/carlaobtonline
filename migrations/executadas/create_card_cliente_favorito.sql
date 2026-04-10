-- Migration: Criar tabela para favoritos de comandas (cards) por usuário
-- Data: 2026

CREATE TABLE IF NOT EXISTS "CardClienteFavorito" (
  id TEXT PRIMARY KEY,
  "cardId" TEXT NOT NULL REFERENCES "CardCliente"(id) ON DELETE CASCADE,
  "usuarioId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_card_cliente_favorito_usuario_card
ON "CardClienteFavorito"("usuarioId", "cardId");

CREATE INDEX IF NOT EXISTS idx_card_cliente_favorito_usuario
ON "CardClienteFavorito"("usuarioId");

CREATE INDEX IF NOT EXISTS idx_card_cliente_favorito_card
ON "CardClienteFavorito"("cardId");

