-- Migration: Criar módulo de Professores e Aulas
-- Data: 2024-12
-- Descrição: Adiciona todas as tabelas necessárias para o módulo de professores, aulas e alunos

-- ========== ADICIONAR NOVO ROLE ==========
-- Adicionar PROFESSOR ao enum Role (se ainda não existir)
-- Nota: Se o enum já existir, este comando será ignorado
DO $$ 
BEGIN
    -- Tentar adicionar PROFESSOR ao enum Role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PROFESSOR' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
    ) THEN
        ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PROFESSOR';
    END IF;
END $$;

-- ========== ADICIONAR CAMPOS DE RECORRÊNCIA NO AGENDAMENTO (se ainda não existirem) ==========
ALTER TABLE "Agendamento" 
ADD COLUMN IF NOT EXISTS "recorrenciaId" TEXT DEFAULT NULL;

ALTER TABLE "Agendamento" 
ADD COLUMN IF NOT EXISTS "recorrenciaConfig" JSONB DEFAULT NULL;

-- Índice para busca de agendamentos por recorrência
CREATE INDEX IF NOT EXISTS idx_agendamento_recorrencia_id ON "Agendamento"("recorrenciaId");

-- Comentários
COMMENT ON COLUMN "Agendamento"."recorrenciaId" IS 'ID que agrupa agendamentos recorrentes';
COMMENT ON COLUMN "Agendamento"."recorrenciaConfig" IS 'Configuração de recorrência (tipo, intervalo, dias da semana, etc.)';

-- ========== CRIAR ENUMS ==========

-- Tipo de Aula
DO $$ BEGIN
    CREATE TYPE "TipoAula" AS ENUM ('INDIVIDUAL', 'GRUPO', 'TURMA');po
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Nível de Aula
DO $$ BEGIN
    CREATE TYPE "NivelAula" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status de Aula
DO $$ BEGIN
    CREATE TYPE "StatusAula" AS ENUM ('AGENDADA', 'CONFIRMADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA', 'ADIADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status de Inscrição
DO $$ BEGIN
    CREATE TYPE "StatusInscricao" AS ENUM ('CONFIRMADO', 'AGUARDANDO', 'CANCELADO', 'FALTOU');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========== CRIAR TABELA PROFESSOR ==========
CREATE TABLE IF NOT EXISTS "Professor" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT UNIQUE NOT NULL,
    especialidade VARCHAR(100) DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    "valorHora" DECIMAL(10, 2) DEFAULT NULL,
    "telefoneProfissional" VARCHAR(20) DEFAULT NULL,
    "emailProfissional" VARCHAR(255) DEFAULT NULL,
    ativo BOOLEAN DEFAULT true,
    "aceitaNovosAlunos" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_professor_user FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Índices para Professor
CREATE INDEX IF NOT EXISTS idx_professor_user_id ON "Professor"("userId");
CREATE INDEX IF NOT EXISTS idx_professor_ativo ON "Professor"(ativo);

-- Comentários
COMMENT ON TABLE "Professor" IS 'Perfil profissional de um usuário professor';
COMMENT ON COLUMN "Professor"."userId" IS 'Referência única ao usuário (1:1)';
COMMENT ON COLUMN "Professor"."valorHora" IS 'Valor padrão por hora de aula';
COMMENT ON COLUMN "Professor"."aceitaNovosAlunos" IS 'Se o professor está aceitando novos alunos';

-- ========== CRIAR TABELA AULA ==========
CREATE TABLE IF NOT EXISTS "Aula" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "professorId" TEXT NOT NULL,
    "agendamentoId" TEXT UNIQUE NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT DEFAULT NULL,
    "tipoAula" "TipoAula" NOT NULL,
    nivel "NivelAula" DEFAULT NULL,
    "maxAlunos" INTEGER DEFAULT 1,
    "valorPorAluno" DECIMAL(10, 2) DEFAULT NULL,
    "valorTotal" DECIMAL(10, 2) DEFAULT NULL,
    status "StatusAula" DEFAULT 'AGENDADA',
    "dataInicio" TIMESTAMP WITH TIME ZONE NOT NULL,
    "dataFim" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    "recorrenciaId" TEXT DEFAULT NULL,
    "recorrenciaConfig" JSONB DEFAULT NULL,
    observacoes TEXT DEFAULT NULL,
    "materialNecessario" TEXT DEFAULT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_aula_professor FOREIGN KEY ("professorId") REFERENCES "Professor"(id) ON DELETE CASCADE,
    CONSTRAINT fk_aula_agendamento FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"(id) ON DELETE CASCADE
);

-- Índices para Aula
CREATE INDEX IF NOT EXISTS idx_aula_professor_id ON "Aula"("professorId");
CREATE INDEX IF NOT EXISTS idx_aula_agendamento_id ON "Aula"("agendamentoId");
CREATE INDEX IF NOT EXISTS idx_aula_status ON "Aula"(status);
CREATE INDEX IF NOT EXISTS idx_aula_data_inicio ON "Aula"("dataInicio");
CREATE INDEX IF NOT EXISTS idx_aula_recorrencia_id ON "Aula"("recorrenciaId");
CREATE INDEX IF NOT EXISTS idx_aula_professor_data ON "Aula"("professorId", "dataInicio");

-- Comentários
COMMENT ON TABLE "Aula" IS 'Aula que utiliza um agendamento existente';
COMMENT ON COLUMN "Aula"."agendamentoId" IS 'Referência única ao agendamento (1:1)';
COMMENT ON COLUMN "Aula"."valorPorAluno" IS 'Valor específico por aluno nesta aula';
COMMENT ON COLUMN "Aula"."valorTotal" IS 'Valor total fixo da aula';

-- ========== CRIAR TABELA ALUNO_AULA ==========
CREATE TABLE IF NOT EXISTS "AlunoAula" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "aulaId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "statusInscricao" "StatusInscricao" DEFAULT 'CONFIRMADO',
    presenca BOOLEAN DEFAULT NULL,
    "valorPago" DECIMAL(10, 2) DEFAULT NULL,
    "valorDevido" DECIMAL(10, 2) DEFAULT NULL,
    "pagamentoId" TEXT DEFAULT NULL,
    observacao TEXT DEFAULT NULL,
    "notaAluno" TEXT DEFAULT NULL,
    "inscritoEm" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "canceladoEm" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_aluno_aula_aula FOREIGN KEY ("aulaId") REFERENCES "Aula"(id) ON DELETE CASCADE,
    CONSTRAINT fk_aluno_aula_atleta FOREIGN KEY ("atletaId") REFERENCES "Atleta"(id) ON DELETE CASCADE,
    CONSTRAINT uk_aluno_aula_unique UNIQUE ("aulaId", "atletaId")
);

-- Índices para AlunoAula
CREATE INDEX IF NOT EXISTS idx_aluno_aula_aula_id ON "AlunoAula"("aulaId");
CREATE INDEX IF NOT EXISTS idx_aluno_aula_atleta_id ON "AlunoAula"("atletaId");
CREATE INDEX IF NOT EXISTS idx_aluno_aula_status ON "AlunoAula"("statusInscricao");
CREATE INDEX IF NOT EXISTS idx_aluno_aula_presenca ON "AlunoAula"(presenca);

-- Comentários
COMMENT ON TABLE "AlunoAula" IS 'Relação entre aluno (atleta) e aula com dados específicos da inscrição';
COMMENT ON COLUMN "AlunoAula".presenca IS 'null = não informado, true = presente, false = faltou';

-- ========== CRIAR TABELA ALUNO_PROFESSOR ==========
CREATE TABLE IF NOT EXISTS "AlunoProfessor" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "professorId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    nivel "NivelAula" DEFAULT NULL,
    observacoes TEXT DEFAULT NULL,
    ativo BOOLEAN DEFAULT true,
    "iniciadoEm" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "encerradoEm" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_aluno_professor_professor FOREIGN KEY ("professorId") REFERENCES "Professor"(id) ON DELETE CASCADE,
    CONSTRAINT fk_aluno_professor_atleta FOREIGN KEY ("atletaId") REFERENCES "Atleta"(id) ON DELETE CASCADE,
    CONSTRAINT uk_aluno_professor_unique UNIQUE ("professorId", "atletaId")
);

-- Índices para AlunoProfessor
CREATE INDEX IF NOT EXISTS idx_aluno_professor_professor_id ON "AlunoProfessor"("professorId");
CREATE INDEX IF NOT EXISTS idx_aluno_professor_atleta_id ON "AlunoProfessor"("atletaId");
CREATE INDEX IF NOT EXISTS idx_aluno_professor_ativo ON "AlunoProfessor"(ativo);

-- Comentários
COMMENT ON TABLE "AlunoProfessor" IS 'Relação muitos-para-muitos entre professor e aluno (atleta)';
COMMENT ON COLUMN "AlunoProfessor".nivel IS 'Nível atual do aluno com este professor específico';

-- ========== CRIAR TABELA AVALIACAO_ALUNO ==========
CREATE TABLE IF NOT EXISTS "AvaliacaoAluno" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "aulaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    nota DECIMAL(4, 2) DEFAULT NULL,
    comentario TEXT DEFAULT NULL,
    "pontosPositivos" TEXT DEFAULT NULL,
    "pontosMelhorar" TEXT DEFAULT NULL,
    tecnica INTEGER DEFAULT NULL,
    fisico INTEGER DEFAULT NULL,
    comportamento INTEGER DEFAULT NULL,
    "avaliadoEm" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_avaliacao_aula FOREIGN KEY ("aulaId") REFERENCES "Aula"(id) ON DELETE CASCADE,
    CONSTRAINT fk_avaliacao_professor FOREIGN KEY ("professorId") REFERENCES "Professor"(id) ON DELETE CASCADE,
    CONSTRAINT fk_avaliacao_atleta FOREIGN KEY ("atletaId") REFERENCES "Atleta"(id) ON DELETE CASCADE,
    CONSTRAINT uk_avaliacao_unique UNIQUE ("aulaId", "atletaId")
);

-- Índices para AvaliacaoAluno
CREATE INDEX IF NOT EXISTS idx_avaliacao_professor_id ON "AvaliacaoAluno"("professorId");
CREATE INDEX IF NOT EXISTS idx_avaliacao_atleta_id ON "AvaliacaoAluno"("atletaId");
CREATE INDEX IF NOT EXISTS idx_avaliacao_aula_id ON "AvaliacaoAluno"("aulaId");
CREATE INDEX IF NOT EXISTS idx_avaliacao_avaliado_em ON "AvaliacaoAluno"("avaliadoEm");

-- Comentários
COMMENT ON TABLE "AvaliacaoAluno" IS 'Avaliações e feedback que o professor dá sobre o aluno em uma aula';
COMMENT ON COLUMN "AvaliacaoAluno".nota IS 'Nota de 0 a 10 (ou outro sistema)';
COMMENT ON COLUMN "AvaliacaoAluno".tecnica IS 'Nota de técnica (1-10)';
COMMENT ON COLUMN "AvaliacaoAluno".fisico IS 'Nota física/condicionamento (1-10)';
COMMENT ON COLUMN "AvaliacaoAluno".comportamento IS 'Nota de comportamento (1-10)';

-- ========== TRIGGER PARA UPDATED_AT ==========
-- Trigger para atualizar updatedAt automaticamente

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger nas novas tabelas
DROP TRIGGER IF EXISTS update_professor_updated_at ON "Professor";
CREATE TRIGGER update_professor_updated_at BEFORE UPDATE ON "Professor" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_aula_updated_at ON "Aula";
CREATE TRIGGER update_aula_updated_at BEFORE UPDATE ON "Aula" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_aluno_aula_updated_at ON "AlunoAula";
CREATE TRIGGER update_aluno_aula_updated_at BEFORE UPDATE ON "AlunoAula" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_aluno_professor_updated_at ON "AlunoProfessor";
CREATE TRIGGER update_aluno_professor_updated_at BEFORE UPDATE ON "AlunoProfessor" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_avaliacao_aluno_updated_at ON "AvaliacaoAluno";
CREATE TRIGGER update_avaliacao_aluno_updated_at BEFORE UPDATE ON "AvaliacaoAluno" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

