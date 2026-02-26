-- Migration: Horário de Atendimento por arena (Point)

CREATE TABLE IF NOT EXISTS "HorarioAtendimentoPoint" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL,
  "diaSemana" INTEGER NOT NULL,
  "inicioMin" INTEGER NOT NULL,
  "fimMin" INTEGER NOT NULL,
  ativo BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_horario_atendimento_point_point FOREIGN KEY ("pointId") REFERENCES "Point"(id) ON DELETE CASCADE,
  CONSTRAINT ck_horario_atendimento_point_dia_semana CHECK ("diaSemana" >= 0 AND "diaSemana" <= 6),
  CONSTRAINT ck_horario_atendimento_point_minutos CHECK ("inicioMin" >= 0 AND "inicioMin" < 1440 AND "fimMin" > 0 AND "fimMin" <= 1440 AND "fimMin" > "inicioMin")
);

CREATE INDEX IF NOT EXISTS idx_horario_atendimento_point_point_dia ON "HorarioAtendimentoPoint"("pointId", "diaSemana");
