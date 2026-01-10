-- Adicionar campo createdById na tabela Partida
-- Permite identificar quem criou a partida para permitir exclusão pelo criador

ALTER TABLE "Partida" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

-- Comentário explicativo
COMMENT ON COLUMN "Partida"."createdById" IS 'ID do usuário que criou a partida. Permite que o criador exclua a partida mesmo que seja de uma panelinha.';


