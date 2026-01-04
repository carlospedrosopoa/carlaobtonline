--
-- PostgreSQL database dump
--

-- Dumped from database version 17.7 (bdc8956)
-- Dumped by pg_dump version 17.5

-- Started on 2026-01-03 05:53:08

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 41051)
-- Name: public; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO neondb_owner;

--
-- TOC entry 907 (class 1247 OID 41094)
-- Name: FormatoPartida; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."FormatoPartida" AS ENUM (
    'SET_UNICO',
    'ITF'
);


ALTER TYPE public."FormatoPartida" OWNER TO neondb_owner;

--
-- TOC entry 1003 (class 1247 OID 450570)
-- Name: NivelAula; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."NivelAula" AS ENUM (
    'INICIANTE',
    'INTERMEDIARIO',
    'AVANCADO'
);


ALTER TYPE public."NivelAula" OWNER TO neondb_owner;

--
-- TOC entry 901 (class 1247 OID 41073)
-- Name: Role; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'USER',
    'ORGANIZER',
    'PROFESSOR'
);


ALTER TYPE public."Role" OWNER TO neondb_owner;

--
-- TOC entry 916 (class 1247 OID 90365)
-- Name: StatusAgendamento; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."StatusAgendamento" AS ENUM (
    'CONFIRMADO',
    'CANCELADO',
    'CONCLUIDO'
);


ALTER TYPE public."StatusAgendamento" OWNER TO neondb_owner;

--
-- TOC entry 1006 (class 1247 OID 450578)
-- Name: StatusAula; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."StatusAula" AS ENUM (
    'AGENDADA',
    'CONFIRMADA',
    'EM_ANDAMENTO',
    'CONCLUIDA',
    'CANCELADA',
    'ADIADA'
);


ALTER TYPE public."StatusAula" OWNER TO neondb_owner;

--
-- TOC entry 1009 (class 1247 OID 450592)
-- Name: StatusInscricao; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."StatusInscricao" AS ENUM (
    'CONFIRMADO',
    'AGUARDANDO',
    'CANCELADO',
    'FALTOU'
);


ALTER TYPE public."StatusInscricao" OWNER TO neondb_owner;

--
-- TOC entry 1000 (class 1247 OID 450562)
-- Name: TipoAula; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."TipoAula" AS ENUM (
    'INDIVIDUAL',
    'GRUPO',
    'TURMA'
);


ALTER TYPE public."TipoAula" OWNER TO neondb_owner;

--
-- TOC entry 274 (class 1255 OID 368643)
-- Name: normalizar_telefone(text); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.normalizar_telefone(telefone_input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF telefone_input IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN REGEXP_REPLACE(telefone_input, '[^0-9]', '', 'g');
END;
$$;


ALTER FUNCTION public.normalizar_telefone(telefone_input text) OWNER TO neondb_owner;

--
-- TOC entry 4146 (class 0 OID 0)
-- Dependencies: 274
-- Name: FUNCTION normalizar_telefone(telefone_input text); Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON FUNCTION public.normalizar_telefone(telefone_input text) IS 'Normaliza telefone removendo caracteres nÃ£o numÃ©ricos';


--
-- TOC entry 273 (class 1255 OID 213259)
-- Name: proximo_numero_card(text); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.proximo_numero_card(p_point_id text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  proximo_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX("numeroCard"), 0) + 1
  INTO proximo_numero
  FROM "CardCliente"
  WHERE "pointId" = p_point_id;
  
  RETURN proximo_numero;
END;
$$;


ALTER FUNCTION public.proximo_numero_card(p_point_id text) OWNER TO neondb_owner;

--
-- TOC entry 275 (class 1255 OID 368649)
-- Name: telefone_ja_cadastrado(text); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.telefone_ja_cadastrado(telefone_input text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  telefone_normalizado TEXT;
  existe BOOLEAN;
BEGIN
  telefone_normalizado := normalizar_telefone(telefone_input);
  
  IF telefone_normalizado IS NULL OR telefone_normalizado = '' THEN
    RETURN FALSE;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 
    FROM "Atleta" 
    WHERE normalizar_telefone(fone) = telefone_normalizado
      AND fone IS NOT NULL
  ) INTO existe;
  
  RETURN existe;
END;
$$;


ALTER FUNCTION public.telefone_ja_cadastrado(telefone_input text) OWNER TO neondb_owner;

--
-- TOC entry 4147 (class 0 OID 0)
-- Dependencies: 275
-- Name: FUNCTION telefone_ja_cadastrado(telefone_input text); Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON FUNCTION public.telefone_ja_cadastrado(telefone_input text) IS 'Verifica se um telefone jÃ¡ estÃ¡ cadastrado em algum atleta';


--
-- TOC entry 272 (class 1255 OID 139285)
-- Name: update_bloqueio_agenda_updated_at(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_bloqueio_agenda_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_bloqueio_agenda_updated_at() OWNER TO neondb_owner;

--
-- TOC entry 277 (class 1255 OID 483385)
-- Name: update_competicao_updated_at(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_competicao_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_competicao_updated_at() OWNER TO neondb_owner;

--
-- TOC entry 276 (class 1255 OID 213251)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 240 (class 1259 OID 270336)
-- Name: AberturaCaixa; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AberturaCaixa" (
    id text NOT NULL,
    "pointId" text NOT NULL,
    "saldoInicial" numeric(10,2) NOT NULL,
    status text NOT NULL,
    "dataAbertura" date NOT NULL,
    "dataFechamento" timestamp without time zone,
    "saldoFinal" numeric(10,2),
    observacoes text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" text,
    "fechadoBy" text,
    "createdById" text,
    "updatedById" text,
    CONSTRAINT "AberturaCaixa_status_check" CHECK ((status = ANY (ARRAY['ABERTA'::text, 'FECHADA'::text])))
);


ALTER TABLE public."AberturaCaixa" OWNER TO neondb_owner;

--
-- TOC entry 4148 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN "AberturaCaixa"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AberturaCaixa"."createdById" IS 'ID do usuÃ¡rio que abriu o caixa';


--
-- TOC entry 4149 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN "AberturaCaixa"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AberturaCaixa"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o da abertura de caixa';


--
-- TOC entry 224 (class 1259 OID 90389)
-- Name: Agendamento; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Agendamento" (
    id text NOT NULL,
    "quadraId" text NOT NULL,
    "usuarioId" text,
    "dataHora" timestamp(3) without time zone NOT NULL,
    duracao integer DEFAULT 60 NOT NULL,
    status public."StatusAgendamento" DEFAULT 'CONFIRMADO'::public."StatusAgendamento" NOT NULL,
    observacoes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "atletaId" text,
    "nomeAvulso" text,
    "telefoneAvulso" text,
    "valorCalculado" numeric(10,2),
    "valorHora" numeric(10,2),
    "valorNegociado" numeric(10,2),
    "recorrenciaId" text,
    "recorrenciaConfig" jsonb,
    "ehAula" boolean DEFAULT false,
    "professorId" text,
    "competicaoId" text,
    "createdById" text,
    "updatedById" text
);


ALTER TABLE public."Agendamento" OWNER TO neondb_owner;

--
-- TOC entry 4150 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN "Agendamento"."recorrenciaId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Agendamento"."recorrenciaId" IS 'ID que agrupa agendamentos recorrentes';


--
-- TOC entry 4151 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN "Agendamento"."recorrenciaConfig"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Agendamento"."recorrenciaConfig" IS 'ConfiguraÃ§Ã£o de recorrÃªncia (tipo, intervalo, dias da semana, etc.)';


--
-- TOC entry 4152 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN "Agendamento"."ehAula"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Agendamento"."ehAula" IS 'Indica se o agendamento Ã© para uma aula/professor (true) ou locaÃ§Ã£o normal (false)';


--
-- TOC entry 4153 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN "Agendamento"."professorId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Agendamento"."professorId" IS 'ID do professor vinculado ao agendamento (apenas quando ehAula = true)';


--
-- TOC entry 4154 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN "Agendamento"."competicaoId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Agendamento"."competicaoId" IS 'ID da competiÃ§Ã£o relacionada ao agendamento. Quando um agendamento Ã© vinculado a uma competiÃ§Ã£o, a competiÃ§Ã£o pode usar mÃºltiplas quadras e horÃ¡rios.';


--
-- TOC entry 4155 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN "Agendamento"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Agendamento"."createdById" IS 'ID do usuÃ¡rio que criou o agendamento';


--
-- TOC entry 4156 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN "Agendamento"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Agendamento"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o do agendamento';


--
-- TOC entry 241 (class 1259 OID 311314)
-- Name: AgendamentoAtleta; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AgendamentoAtleta" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "agendamentoId" text NOT NULL,
    "atletaId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "createdBy" text
);


ALTER TABLE public."AgendamentoAtleta" OWNER TO neondb_owner;

--
-- TOC entry 4157 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE "AgendamentoAtleta"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."AgendamentoAtleta" IS 'Relacionamento muitos-para-muitos entre Agendamento e Atleta. Permite que um agendamento tenha mÃºltiplos participantes.';


--
-- TOC entry 4158 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN "AgendamentoAtleta"."agendamentoId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AgendamentoAtleta"."agendamentoId" IS 'ID do agendamento';


--
-- TOC entry 4159 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN "AgendamentoAtleta"."atletaId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AgendamentoAtleta"."atletaId" IS 'ID do atleta participante';


--
-- TOC entry 4160 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN "AgendamentoAtleta"."createdBy"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AgendamentoAtleta"."createdBy" IS 'ID do usuÃ¡rio que adicionou o atleta ao agendamento';


--
-- TOC entry 260 (class 1259 OID 565249)
-- Name: AgendamentoParticipante; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AgendamentoParticipante" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "agendamentoId" text NOT NULL,
    "atletaId" text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now()
);


ALTER TABLE public."AgendamentoParticipante" OWNER TO neondb_owner;

--
-- TOC entry 251 (class 1259 OID 450658)
-- Name: AlunoAula; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AlunoAula" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "aulaId" text NOT NULL,
    "atletaId" text NOT NULL,
    "statusInscricao" public."StatusInscricao" DEFAULT 'CONFIRMADO'::public."StatusInscricao",
    presenca boolean,
    "valorPago" numeric(10,2) DEFAULT NULL::numeric,
    "valorDevido" numeric(10,2) DEFAULT NULL::numeric,
    "pagamentoId" text,
    observacao text,
    "notaAluno" text,
    "inscritoEm" timestamp with time zone DEFAULT now(),
    "canceladoEm" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."AlunoAula" OWNER TO neondb_owner;

--
-- TOC entry 4161 (class 0 OID 0)
-- Dependencies: 251
-- Name: TABLE "AlunoAula"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."AlunoAula" IS 'RelaÃ§Ã£o entre aluno (atleta) e aula com dados especÃ­ficos da inscriÃ§Ã£o';


--
-- TOC entry 4162 (class 0 OID 0)
-- Dependencies: 251
-- Name: COLUMN "AlunoAula".presenca; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AlunoAula".presenca IS 'null = nÃ£o informado, true = presente, false = faltou';


--
-- TOC entry 252 (class 1259 OID 450688)
-- Name: AlunoProfessor; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AlunoProfessor" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "professorId" text NOT NULL,
    "atletaId" text NOT NULL,
    nivel public."NivelAula",
    observacoes text,
    ativo boolean DEFAULT true,
    "iniciadoEm" timestamp with time zone DEFAULT now(),
    "encerradoEm" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."AlunoProfessor" OWNER TO neondb_owner;

--
-- TOC entry 4163 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE "AlunoProfessor"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."AlunoProfessor" IS 'RelaÃ§Ã£o muitos-para-muitos entre professor e aluno (atleta)';


--
-- TOC entry 4164 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN "AlunoProfessor".nivel; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AlunoProfessor".nivel IS 'NÃ­vel atual do aluno com este professor especÃ­fico';


--
-- TOC entry 219 (class 1259 OID 41080)
-- Name: Atleta; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Atleta" (
    id text NOT NULL,
    nome text NOT NULL,
    categoria text,
    "fotoUrl" text,
    "usuarioId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "dataNascimento" timestamp(3) without time zone NOT NULL,
    genero text,
    fone text,
    "pointIdPrincipal" text,
    assinante boolean DEFAULT false,
    "esportePreferido" character varying(100) DEFAULT NULL::character varying,
    "esportesPratica" jsonb,
    "aceitaLembretesAgendamento" boolean DEFAULT false
);


ALTER TABLE public."Atleta" OWNER TO neondb_owner;

--
-- TOC entry 4165 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN "Atleta".assinante; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Atleta".assinante IS 'Indica se o atleta possui assinatura ativa (apenas ADMIN pode alterar)';


--
-- TOC entry 4166 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN "Atleta"."esportePreferido"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Atleta"."esportePreferido" IS 'Esporte preferido do atleta (usado como padrÃ£o nas seleÃ§Ãµes)';


--
-- TOC entry 4167 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN "Atleta"."esportesPratica"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Atleta"."esportesPratica" IS 'Array JSON de esportes que o atleta pratica (ex: ["TÃªnis", "Futebol", "VÃ´lei"])';


--
-- TOC entry 4168 (class 0 OID 0)
-- Dependencies: 219
-- Name: COLUMN "Atleta"."aceitaLembretesAgendamento"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Atleta"."aceitaLembretesAgendamento" IS 'Indica se o atleta aceita receber lembretes de agendamento via WhatsApp. Por padrÃ£o Ã© false (nÃ£o aceita)';


--
-- TOC entry 256 (class 1259 OID 483352)
-- Name: AtletaCompeticao; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AtletaCompeticao" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "competicaoId" text NOT NULL,
    "atletaId" text NOT NULL,
    "parceriaId" text,
    "parceiroAtletaId" text,
    "posicaoFinal" integer,
    pontos numeric(10,2) DEFAULT 0,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdById" text,
    "updatedById" text
);


ALTER TABLE public."AtletaCompeticao" OWNER TO neondb_owner;

--
-- TOC entry 4169 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN "AtletaCompeticao"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AtletaCompeticao"."createdById" IS 'ID do usuÃ¡rio que inscreveu o atleta na competiÃ§Ã£o';


--
-- TOC entry 4170 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN "AtletaCompeticao"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AtletaCompeticao"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o da inscriÃ§Ã£o';


--
-- TOC entry 227 (class 1259 OID 163840)
-- Name: AtletaPoint; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AtletaPoint" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "atletaId" text NOT NULL,
    "pointId" text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now()
);


ALTER TABLE public."AtletaPoint" OWNER TO neondb_owner;

--
-- TOC entry 250 (class 1259 OID 450626)
-- Name: Aula; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Aula" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "professorId" text NOT NULL,
    "agendamentoId" text NOT NULL,
    titulo character varying(255) NOT NULL,
    descricao text,
    "tipoAula" public."TipoAula" NOT NULL,
    nivel public."NivelAula",
    "maxAlunos" integer DEFAULT 1,
    "valorPorAluno" numeric(10,2) DEFAULT NULL::numeric,
    "valorTotal" numeric(10,2) DEFAULT NULL::numeric,
    status public."StatusAula" DEFAULT 'AGENDADA'::public."StatusAula",
    "dataInicio" timestamp with time zone NOT NULL,
    "dataFim" timestamp with time zone,
    "recorrenciaId" text,
    "recorrenciaConfig" jsonb,
    observacoes text,
    "materialNecessario" text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."Aula" OWNER TO neondb_owner;

--
-- TOC entry 4171 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE "Aula"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."Aula" IS 'Aula que utiliza um agendamento existente';


--
-- TOC entry 4172 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN "Aula"."agendamentoId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Aula"."agendamentoId" IS 'ReferÃªncia Ãºnica ao agendamento (1:1)';


--
-- TOC entry 4173 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN "Aula"."valorPorAluno"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Aula"."valorPorAluno" IS 'Valor especÃ­fico por aluno nesta aula';


--
-- TOC entry 4174 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN "Aula"."valorTotal"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Aula"."valorTotal" IS 'Valor total fixo da aula';


--
-- TOC entry 253 (class 1259 OID 450715)
-- Name: AvaliacaoAluno; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AvaliacaoAluno" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "aulaId" text NOT NULL,
    "professorId" text NOT NULL,
    "atletaId" text NOT NULL,
    nota numeric(4,2) DEFAULT NULL::numeric,
    comentario text,
    "pontosPositivos" text,
    "pontosMelhorar" text,
    tecnica integer,
    fisico integer,
    comportamento integer,
    "avaliadoEm" timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."AvaliacaoAluno" OWNER TO neondb_owner;

--
-- TOC entry 4175 (class 0 OID 0)
-- Dependencies: 253
-- Name: TABLE "AvaliacaoAluno"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."AvaliacaoAluno" IS 'AvaliaÃ§Ãµes e feedback que o professor dÃ¡ sobre o aluno em uma aula';


--
-- TOC entry 4176 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN "AvaliacaoAluno".nota; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AvaliacaoAluno".nota IS 'Nota de 0 a 10 (ou outro sistema)';


--
-- TOC entry 4177 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN "AvaliacaoAluno".tecnica; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AvaliacaoAluno".tecnica IS 'Nota de tÃ©cnica (1-10)';


--
-- TOC entry 4178 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN "AvaliacaoAluno".fisico; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AvaliacaoAluno".fisico IS 'Nota fÃ­sica/condicionamento (1-10)';


--
-- TOC entry 4179 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN "AvaliacaoAluno".comportamento; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."AvaliacaoAluno".comportamento IS 'Nota de comportamento (1-10)';


--
-- TOC entry 226 (class 1259 OID 139264)
-- Name: BloqueioAgenda; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."BloqueioAgenda" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    "quadraIds" jsonb,
    titulo text NOT NULL,
    descricao text,
    "dataInicio" timestamp without time zone NOT NULL,
    "dataFim" timestamp without time zone NOT NULL,
    "horaInicio" integer,
    "horaFim" integer,
    ativo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."BloqueioAgenda" OWNER TO neondb_owner;

--
-- TOC entry 228 (class 1259 OID 212992)
-- Name: CardCliente; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."CardCliente" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    "numeroCard" integer NOT NULL,
    status text DEFAULT 'ABERTO'::text NOT NULL,
    observacoes text,
    "valorTotal" numeric(10,2) DEFAULT 0,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "createdBy" text,
    "fechadoAt" timestamp with time zone,
    "fechadoBy" text,
    "usuarioId" text,
    "nomeAvulso" text,
    "telefoneAvulso" text,
    "createdById" text,
    "updatedById" text,
    CONSTRAINT "CardCliente_status_check" CHECK ((status = ANY (ARRAY['ABERTO'::text, 'FECHADO'::text, 'CANCELADO'::text])))
);


ALTER TABLE public."CardCliente" OWNER TO neondb_owner;

--
-- TOC entry 4180 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE "CardCliente"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."CardCliente" IS 'Cards de atendimento de clientes (mesas/comandas)';


--
-- TOC entry 4181 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN "CardCliente"."usuarioId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."CardCliente"."usuarioId" IS 'UsuÃ¡rio vinculado ao card (opcional). Permite que o usuÃ¡rio acesse seu histÃ³rico de consumo.';


--
-- TOC entry 4182 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN "CardCliente"."nomeAvulso"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."CardCliente"."nomeAvulso" IS 'Nome do cliente quando nÃ£o hÃ¡ usuÃ¡rio vinculado (cliente avulso)';


--
-- TOC entry 4183 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN "CardCliente"."telefoneAvulso"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."CardCliente"."telefoneAvulso" IS 'Telefone do cliente quando nÃ£o hÃ¡ usuÃ¡rio vinculado (cliente avulso)';


--
-- TOC entry 4184 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN "CardCliente"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."CardCliente"."createdById" IS 'ID do usuÃ¡rio que criou o card de cliente';


--
-- TOC entry 4185 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN "CardCliente"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."CardCliente"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o do card de cliente';


--
-- TOC entry 234 (class 1259 OID 213137)
-- Name: CategoriaSaida; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."CategoriaSaida" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."CategoriaSaida" OWNER TO neondb_owner;

--
-- TOC entry 4186 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE "CategoriaSaida"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."CategoriaSaida" IS 'Categorias para classificar saÃ­das de caixa';


--
-- TOC entry 235 (class 1259 OID 213157)
-- Name: CentroCusto; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."CentroCusto" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."CentroCusto" OWNER TO neondb_owner;

--
-- TOC entry 4187 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE "CentroCusto"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."CentroCusto" IS 'Centros de custo para controle financeiro';


--
-- TOC entry 255 (class 1259 OID 483328)
-- Name: Competicao; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Competicao" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    "quadraId" text,
    nome text NOT NULL,
    tipo text NOT NULL,
    formato text NOT NULL,
    status text DEFAULT 'CRIADA'::text NOT NULL,
    "dataInicio" timestamp with time zone,
    "dataFim" timestamp with time zone,
    descricao text,
    "valorInscricao" numeric(10,2),
    premio text,
    regras text,
    "configSuper8" jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "cardDivulgacaoUrl" text,
    "fotoCompeticaoUrl" text,
    "createdById" text,
    "updatedById" text,
    CONSTRAINT "Competicao_formato_check" CHECK ((formato = ANY (ARRAY['DUPLAS'::text, 'INDIVIDUAL'::text]))),
    CONSTRAINT "Competicao_status_check" CHECK ((status = ANY (ARRAY['CRIADA'::text, 'EM_ANDAMENTO'::text, 'CONCLUIDA'::text, 'CANCELADA'::text]))),
    CONSTRAINT "Competicao_tipo_check" CHECK ((tipo = ANY (ARRAY['SUPER_8'::text, 'SUPER_12'::text, 'REI_DA_QUADRA'::text])))
);


ALTER TABLE public."Competicao" OWNER TO neondb_owner;

--
-- TOC entry 4188 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN "Competicao"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Competicao"."createdById" IS 'ID do usuÃ¡rio que criou a competiÃ§Ã£o';


--
-- TOC entry 4189 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN "Competicao"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Competicao"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o da competiÃ§Ã£o';


--
-- TOC entry 236 (class 1259 OID 213177)
-- Name: EntradaCaixa; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."EntradaCaixa" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    valor numeric(10,2) NOT NULL,
    descricao text NOT NULL,
    "formaPagamentoId" text NOT NULL,
    observacoes text,
    "dataEntrada" timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone DEFAULT now(),
    "createdBy" text,
    "aberturaCaixaId" text,
    "createdById" text,
    "updatedById" text
);


ALTER TABLE public."EntradaCaixa" OWNER TO neondb_owner;

--
-- TOC entry 4190 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE "EntradaCaixa"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."EntradaCaixa" IS 'Entradas manuais de caixa';


--
-- TOC entry 4191 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN "EntradaCaixa"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."EntradaCaixa"."createdById" IS 'ID do usuÃ¡rio que criou a entrada de caixa';


--
-- TOC entry 4192 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN "EntradaCaixa"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."EntradaCaixa"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o da entrada de caixa';


--
-- TOC entry 231 (class 1259 OID 213070)
-- Name: FormaPagamento; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."FormaPagamento" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    nome text NOT NULL,
    descricao text,
    tipo text NOT NULL,
    ativo boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    CONSTRAINT "FormaPagamento_tipo_check" CHECK ((tipo = ANY (ARRAY['DINHEIRO'::text, 'CARTAO_CREDITO'::text, 'CARTAO_DEBITO'::text, 'PIX'::text, 'OUTRO'::text])))
);


ALTER TABLE public."FormaPagamento" OWNER TO neondb_owner;

--
-- TOC entry 4193 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE "FormaPagamento"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."FormaPagamento" IS 'Formas de pagamento disponÃ­veis';


--
-- TOC entry 233 (class 1259 OID 213117)
-- Name: Fornecedor; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Fornecedor" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    nome text NOT NULL,
    "nomeFantasia" text,
    cnpj text,
    cpf text,
    telefone text,
    email text,
    endereco text,
    observacoes text,
    ativo boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."Fornecedor" OWNER TO neondb_owner;

--
-- TOC entry 4194 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE "Fornecedor"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."Fornecedor" IS 'Fornecedores para saÃ­das de caixa';


--
-- TOC entry 230 (class 1259 OID 213047)
-- Name: ItemCard; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ItemCard" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "cardId" text NOT NULL,
    "produtoId" text NOT NULL,
    quantidade integer DEFAULT 1 NOT NULL,
    "precoUnitario" numeric(10,2) NOT NULL,
    "precoTotal" numeric(10,2) NOT NULL,
    observacoes text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "createdById" text,
    "updatedById" text
);


ALTER TABLE public."ItemCard" OWNER TO neondb_owner;

--
-- TOC entry 4195 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE "ItemCard"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."ItemCard" IS 'Itens (produtos) adicionados aos cards';


--
-- TOC entry 4196 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN "ItemCard"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."ItemCard"."createdById" IS 'ID do usuÃ¡rio que adicionou o item ao card';


--
-- TOC entry 4197 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN "ItemCard"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."ItemCard"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o do item';


--
-- TOC entry 257 (class 1259 OID 491520)
-- Name: JogoCompeticao; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."JogoCompeticao" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "competicaoId" text NOT NULL,
    rodada text NOT NULL,
    "numeroJogo" integer NOT NULL,
    "atleta1Id" text,
    "atleta2Id" text,
    "atleta1ParceriaId" text,
    "atleta2ParceriaId" text,
    "vencedorId" text,
    "pontosAtleta1" integer DEFAULT 0,
    "pontosAtleta2" integer DEFAULT 0,
    "gamesAtleta1" integer,
    "gamesAtleta2" integer,
    "tiebreakAtleta1" integer,
    "tiebreakAtleta2" integer,
    "dataHora" timestamp with time zone,
    "quadraId" text,
    status text DEFAULT 'AGENDADO'::text NOT NULL,
    observacoes text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "atleta3Id" text,
    "atleta4Id" text,
    "createdById" text,
    "updatedById" text,
    CONSTRAINT "JogoCompeticao_rodada_check" CHECK ((rodada = ANY (ARRAY['RODADA_1'::text, 'RODADA_2'::text, 'RODADA_3'::text, 'RODADA_4'::text, 'RODADA_5'::text, 'RODADA_6'::text, 'RODADA_7'::text, 'QUARTAS_FINAL'::text, 'SEMIFINAL'::text, 'FINAL'::text]))),
    CONSTRAINT "JogoCompeticao_status_check" CHECK ((status = ANY (ARRAY['AGENDADO'::text, 'EM_ANDAMENTO'::text, 'CONCLUIDO'::text, 'CANCELADO'::text])))
);


ALTER TABLE public."JogoCompeticao" OWNER TO neondb_owner;

--
-- TOC entry 4198 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN "JogoCompeticao"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."JogoCompeticao"."createdById" IS 'ID do usuÃ¡rio que criou o jogo da competiÃ§Ã£o';


--
-- TOC entry 4199 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN "JogoCompeticao"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."JogoCompeticao"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o do jogo da competiÃ§Ã£o';


--
-- TOC entry 243 (class 1259 OID 393221)
-- Name: NotificacaoAgendamento; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."NotificacaoAgendamento" (
    id text NOT NULL,
    "agendamentoId" text NOT NULL,
    tipo text NOT NULL,
    enviada boolean DEFAULT false NOT NULL,
    "dataEnvio" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."NotificacaoAgendamento" OWNER TO neondb_owner;

--
-- TOC entry 4200 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE "NotificacaoAgendamento"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."NotificacaoAgendamento" IS 'Registra notificaÃ§Ãµes de agendamento enviadas para evitar duplicatas';


--
-- TOC entry 4201 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN "NotificacaoAgendamento"."agendamentoId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."NotificacaoAgendamento"."agendamentoId" IS 'ID do agendamento relacionado';


--
-- TOC entry 4202 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN "NotificacaoAgendamento".tipo; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."NotificacaoAgendamento".tipo IS 'Tipo de notificaÃ§Ã£o (ex: LEMBRETE_8H, LEMBRETE_24H)';


--
-- TOC entry 4203 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN "NotificacaoAgendamento".enviada; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."NotificacaoAgendamento".enviada IS 'Indica se a notificaÃ§Ã£o foi enviada com sucesso';


--
-- TOC entry 4204 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN "NotificacaoAgendamento"."dataEnvio"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."NotificacaoAgendamento"."dataEnvio" IS 'Data e hora em que a notificaÃ§Ã£o foi enviada';


--
-- TOC entry 232 (class 1259 OID 213091)
-- Name: PagamentoCard; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PagamentoCard" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "cardId" text NOT NULL,
    "formaPagamentoId" text NOT NULL,
    valor numeric(10,2) NOT NULL,
    observacoes text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "createdBy" text,
    "aberturaCaixaId" text,
    "infinitePayOrderId" text,
    "infinitePayTransactionId" text,
    "createdById" text,
    "updatedById" text
);


ALTER TABLE public."PagamentoCard" OWNER TO neondb_owner;

--
-- TOC entry 4205 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE "PagamentoCard"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."PagamentoCard" IS 'Pagamentos realizados nos cards';


--
-- TOC entry 4206 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN "PagamentoCard"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PagamentoCard"."createdById" IS 'ID do usuÃ¡rio que criou o pagamento do card';


--
-- TOC entry 4207 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN "PagamentoCard"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PagamentoCard"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o do pagamento do card';


--
-- TOC entry 248 (class 1259 OID 434176)
-- Name: PagamentoInfinitePay; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PagamentoInfinitePay" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "cardId" text NOT NULL,
    "orderId" text NOT NULL,
    valor numeric(10,2) NOT NULL,
    parcelas integer DEFAULT 1,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "transactionId" text,
    message text,
    "pagamentoCardId" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" text
);


ALTER TABLE public."PagamentoInfinitePay" OWNER TO neondb_owner;

--
-- TOC entry 4208 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE "PagamentoInfinitePay"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."PagamentoInfinitePay" IS 'Armazena pagamentos processados via Infinite Pay';


--
-- TOC entry 4209 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN "PagamentoInfinitePay"."orderId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PagamentoInfinitePay"."orderId" IS 'ID Ãºnico da ordem no Infinite Pay';


--
-- TOC entry 4210 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN "PagamentoInfinitePay".status; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PagamentoInfinitePay".status IS 'Status do pagamento: PENDING, APPROVED, REJECTED, CANCELLED';


--
-- TOC entry 4211 (class 0 OID 0)
-- Dependencies: 248
-- Name: COLUMN "PagamentoInfinitePay"."transactionId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PagamentoInfinitePay"."transactionId" IS 'ID da transaÃ§Ã£o retornado pelo Infinite Pay';


--
-- TOC entry 238 (class 1259 OID 237568)
-- Name: PagamentoItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PagamentoItem" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pagamentoCardId" text NOT NULL,
    "itemCardId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."PagamentoItem" OWNER TO neondb_owner;

--
-- TOC entry 4212 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE "PagamentoItem"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."PagamentoItem" IS 'Relacionamento entre pagamentos e itens do card, permitindo que cada pagamento seja vinculado a itens especÃ­ficos';


--
-- TOC entry 244 (class 1259 OID 409600)
-- Name: Panelinha; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Panelinha" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    nome character varying(255) NOT NULL,
    descricao text,
    "atletaIdCriador" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    esporte character varying(100)
);


ALTER TABLE public."Panelinha" OWNER TO neondb_owner;

--
-- TOC entry 4213 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE "Panelinha"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."Panelinha" IS 'Grupos de atletas criados por um atleta para organizar suas turmas de jogos';


--
-- TOC entry 4214 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN "Panelinha"."atletaIdCriador"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Panelinha"."atletaIdCriador" IS 'ID do atleta que criou a panelinha';


--
-- TOC entry 4215 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN "Panelinha".esporte; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Panelinha".esporte IS 'Esporte praticado nesta panelinha (ex: Beach Tennis, Futebol, etc.)';


--
-- TOC entry 245 (class 1259 OID 409615)
-- Name: PanelinhaAtleta; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PanelinhaAtleta" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "panelinhaId" text NOT NULL,
    "atletaId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."PanelinhaAtleta" OWNER TO neondb_owner;

--
-- TOC entry 4216 (class 0 OID 0)
-- Dependencies: 245
-- Name: TABLE "PanelinhaAtleta"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."PanelinhaAtleta" IS 'Relacionamento entre panelinhas e atletas (muitos-para-muitos)';


--
-- TOC entry 4217 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN "PanelinhaAtleta"."panelinhaId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PanelinhaAtleta"."panelinhaId" IS 'ID da panelinha';


--
-- TOC entry 4218 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN "PanelinhaAtleta"."atletaId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PanelinhaAtleta"."atletaId" IS 'ID do atleta membro da panelinha';


--
-- TOC entry 220 (class 1259 OID 41099)
-- Name: Partida; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Partida" (
    id text NOT NULL,
    data timestamp(3) without time zone NOT NULL,
    local text NOT NULL,
    "atleta1Id" text NOT NULL,
    "atleta2Id" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atleta3Id" text,
    "atleta4Id" text,
    "gamesTime1" integer,
    "gamesTime2" integer,
    "supertiebreakTime1" integer,
    "supertiebreakTime2" integer,
    "tiebreakTime1" integer,
    "tiebreakTime2" integer,
    "torneioId" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "cardUrl" text,
    "cardGeradoEm" timestamp without time zone,
    "cardVersao" integer DEFAULT 0,
    "templateUrl" text,
    "pointId" text
);


ALTER TABLE public."Partida" OWNER TO neondb_owner;

--
-- TOC entry 4219 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN "Partida"."cardUrl"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Partida"."cardUrl" IS 'URL completa do card gerado no Google Cloud Storage (ex: https://storage.googleapis.com/bucket/cards/partida-123.png). NULL quando card ainda nÃ£o foi gerado ou foi invalidado.';


--
-- TOC entry 4220 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN "Partida"."cardGeradoEm"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Partida"."cardGeradoEm" IS 'Timestamp de quando o card foi gerado/atualizado pela Ãºltima vez';


--
-- TOC entry 4221 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN "Partida"."cardVersao"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Partida"."cardVersao" IS 'VersÃ£o do card (incrementa quando card Ã© regenerado apÃ³s atualizaÃ§Ã£o de placar)';


--
-- TOC entry 4222 (class 0 OID 0)
-- Dependencies: 220
-- Name: COLUMN "Partida"."templateUrl"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Partida"."templateUrl" IS 'URL do template de fundo usado para gerar o card desta partida. Armazenado no Google Cloud Storage.';


--
-- TOC entry 246 (class 1259 OID 425984)
-- Name: PartidaPanelinha; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PartidaPanelinha" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "partidaId" text NOT NULL,
    "panelinhaId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."PartidaPanelinha" OWNER TO neondb_owner;

--
-- TOC entry 4223 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE "PartidaPanelinha"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."PartidaPanelinha" IS 'Vincula partidas Ã s panelinhas, permitindo que jogos apareÃ§am tanto na panelinha quanto em "Meus Jogos"';


--
-- TOC entry 4224 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN "PartidaPanelinha"."partidaId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PartidaPanelinha"."partidaId" IS 'ID da partida';


--
-- TOC entry 4225 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN "PartidaPanelinha"."panelinhaId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."PartidaPanelinha"."panelinhaId" IS 'ID da panelinha';


--
-- TOC entry 259 (class 1259 OID 540676)
-- Name: PlatformConfig; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PlatformConfig" (
    id integer NOT NULL,
    chave character varying(255) NOT NULL,
    valor text,
    descricao text,
    tipo character varying(50) DEFAULT 'texto'::character varying,
    categoria character varying(100) DEFAULT 'geral'::character varying,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now()
);


ALTER TABLE public."PlatformConfig" OWNER TO neondb_owner;

--
-- TOC entry 258 (class 1259 OID 540675)
-- Name: PlatformConfig_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."PlatformConfig_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PlatformConfig_id_seq" OWNER TO neondb_owner;

--
-- TOC entry 4226 (class 0 OID 0)
-- Dependencies: 258
-- Name: PlatformConfig_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."PlatformConfig_id_seq" OWNED BY public."PlatformConfig".id;


--
-- TOC entry 222 (class 1259 OID 90371)
-- Name: Point; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Point" (
    id text NOT NULL,
    nome text NOT NULL,
    endereco text,
    telefone text,
    email text,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "logoUrl" text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    "whatsappAccessToken" text,
    "whatsappPhoneNumberId" text,
    "whatsappBusinessAccountId" text,
    "whatsappApiVersion" text DEFAULT 'v21.0'::text,
    "whatsappAtivo" boolean DEFAULT false,
    assinante boolean DEFAULT false,
    "gzappyApiKey" text,
    "gzappyInstanceId" text,
    "gzappyAtivo" boolean DEFAULT false,
    "enviarLembretesAgendamento" boolean DEFAULT false,
    "antecedenciaLembrete" integer DEFAULT 8,
    "infinitePayHandle" text,
    "cardTemplateUrl" text
);


ALTER TABLE public."Point" OWNER TO neondb_owner;

--
-- TOC entry 4227 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."whatsappAccessToken"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."whatsappAccessToken" IS 'Token de acesso da API do WhatsApp Business (Meta)';


--
-- TOC entry 4228 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."whatsappPhoneNumberId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."whatsappPhoneNumberId" IS 'ID do nÃºmero de telefone do WhatsApp Business';


--
-- TOC entry 4229 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."whatsappBusinessAccountId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."whatsappBusinessAccountId" IS 'ID da conta comercial do WhatsApp Business (opcional)';


--
-- TOC entry 4230 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."whatsappApiVersion"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."whatsappApiVersion" IS 'VersÃ£o da API do WhatsApp (padrÃ£o: v21.0)';


--
-- TOC entry 4231 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."whatsappAtivo"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."whatsappAtivo" IS 'Indica se o WhatsApp estÃ¡ ativo para esta arena';


--
-- TOC entry 4232 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point".assinante; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point".assinante IS 'Indica se a arena possui assinatura ativa (apenas ADMIN pode alterar)';


--
-- TOC entry 4233 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."gzappyApiKey"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."gzappyApiKey" IS 'Chave de API do Gzappy para autenticaÃ§Ã£o';


--
-- TOC entry 4234 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."gzappyInstanceId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."gzappyInstanceId" IS 'ID da instÃ¢ncia do Gzappy configurada para esta arena';


--
-- TOC entry 4235 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."gzappyAtivo"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."gzappyAtivo" IS 'Indica se o Gzappy estÃ¡ ativo para esta arena';


--
-- TOC entry 4236 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."enviarLembretesAgendamento"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."enviarLembretesAgendamento" IS 'Indica se o gestor da arena quer enviar lembretes de agendamento para os atletas';


--
-- TOC entry 4237 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."antecedenciaLembrete"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."antecedenciaLembrete" IS 'AntecedÃªncia em horas para envio do lembrete (ex: 8 = 8 horas antes, 24 = 24 horas antes)';


--
-- TOC entry 4238 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."infinitePayHandle"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."infinitePayHandle" IS 'Handle da conta Infinite Pay da arena. Cada arena pode ter sua prÃ³pria conta.';


--
-- TOC entry 4239 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN "Point"."cardTemplateUrl"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Point"."cardTemplateUrl" IS 'URL do template de card de jogos armazenada no Google Cloud Storage (pasta templates/cards)';


--
-- TOC entry 229 (class 1259 OID 213025)
-- Name: Produto; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Produto" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    nome text NOT NULL,
    descricao text,
    "precoVenda" numeric(10,2) DEFAULT 0 NOT NULL,
    "precoCusto" numeric(10,2) DEFAULT 0,
    categoria text,
    ativo boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "acessoRapido" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Produto" OWNER TO neondb_owner;

--
-- TOC entry 4240 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE "Produto"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."Produto" IS 'Produtos vendidos na copa/bar';


--
-- TOC entry 249 (class 1259 OID 450601)
-- Name: Professor; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Professor" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "userId" text NOT NULL,
    especialidade character varying(100) DEFAULT NULL::character varying,
    bio text,
    "valorHora" numeric(10,2) DEFAULT NULL::numeric,
    "telefoneProfissional" character varying(20) DEFAULT NULL::character varying,
    "emailProfissional" character varying(255) DEFAULT NULL::character varying,
    ativo boolean DEFAULT true,
    "aceitaNovosAlunos" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "fotoUrl" text,
    "logoUrl" text,
    "pointIdPrincipal" text
);


ALTER TABLE public."Professor" OWNER TO neondb_owner;

--
-- TOC entry 4241 (class 0 OID 0)
-- Dependencies: 249
-- Name: TABLE "Professor"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."Professor" IS 'Perfil profissional de um usuÃ¡rio professor';


--
-- TOC entry 4242 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN "Professor"."userId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Professor"."userId" IS 'ReferÃªncia Ãºnica ao usuÃ¡rio (1:1)';


--
-- TOC entry 4243 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN "Professor"."valorHora"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Professor"."valorHora" IS 'Valor padrÃ£o por hora de aula';


--
-- TOC entry 4244 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN "Professor"."aceitaNovosAlunos"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Professor"."aceitaNovosAlunos" IS 'Se o professor estÃ¡ aceitando novos alunos';


--
-- TOC entry 4245 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN "Professor"."fotoUrl"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Professor"."fotoUrl" IS 'URL da foto do professor armazenada no Google Cloud Storage';


--
-- TOC entry 4246 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN "Professor"."logoUrl"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Professor"."logoUrl" IS 'URL da logomarca do professor armazenada no Google Cloud Storage';


--
-- TOC entry 4247 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN "Professor"."pointIdPrincipal"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Professor"."pointIdPrincipal" IS 'ID da arena principal onde o professor atua';


--
-- TOC entry 254 (class 1259 OID 466949)
-- Name: ProfessorPoint; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ProfessorPoint" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "professorId" text NOT NULL,
    "pointId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."ProfessorPoint" OWNER TO neondb_owner;

--
-- TOC entry 4248 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE "ProfessorPoint"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."ProfessorPoint" IS 'RelaÃ§Ã£o muitos-para-muitos entre professor e arenas (arenas frequentes)';


--
-- TOC entry 4249 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN "ProfessorPoint"."professorId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."ProfessorPoint"."professorId" IS 'ID do professor';


--
-- TOC entry 4250 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN "ProfessorPoint"."pointId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."ProfessorPoint"."pointId" IS 'ID da arena';


--
-- TOC entry 223 (class 1259 OID 90380)
-- Name: Quadra; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Quadra" (
    id text NOT NULL,
    nome text NOT NULL,
    "pointId" text NOT NULL,
    tipo text,
    capacidade integer,
    ativo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "tiposEsporte" jsonb
);


ALTER TABLE public."Quadra" OWNER TO neondb_owner;

--
-- TOC entry 4251 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN "Quadra"."tiposEsporte"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."Quadra"."tiposEsporte" IS 'Array JSON de tipos de esporte que a quadra atende (ex: ["TÃªnis", "Futebol", "VÃ´lei"])';


--
-- TOC entry 247 (class 1259 OID 426007)
-- Name: RankingPanelinha; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."RankingPanelinha" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "panelinhaId" text NOT NULL,
    "atletaId" text NOT NULL,
    pontuacao integer DEFAULT 0,
    vitorias integer DEFAULT 0,
    derrotas integer DEFAULT 0,
    "derrotasTieBreak" integer DEFAULT 0,
    "partidasJogadas" integer DEFAULT 0,
    "saldoGames" integer DEFAULT 0,
    "gamesFeitos" integer DEFAULT 0,
    "gamesSofridos" integer DEFAULT 0,
    posicao integer,
    "ultimaAtualizacao" timestamp with time zone DEFAULT now()
);


ALTER TABLE public."RankingPanelinha" OWNER TO neondb_owner;

--
-- TOC entry 4252 (class 0 OID 0)
-- Dependencies: 247
-- Name: TABLE "RankingPanelinha"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."RankingPanelinha" IS 'Ranking de cada atleta em cada panelinha';


--
-- TOC entry 4253 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN "RankingPanelinha".pontuacao; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."RankingPanelinha".pontuacao IS 'Total de pontos (vitÃ³rias = 3, derrotas no tie break = 1, derrotas normais = 0)';


--
-- TOC entry 4254 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN "RankingPanelinha"."derrotasTieBreak"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."RankingPanelinha"."derrotasTieBreak" IS 'NÃºmero de derrotas que foram no tie break';


--
-- TOC entry 4255 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN "RankingPanelinha"."saldoGames"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."RankingPanelinha"."saldoGames" IS 'Games feitos - games sofridos (tie break nÃ£o conta)';


--
-- TOC entry 4256 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN "RankingPanelinha"."gamesFeitos"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."RankingPanelinha"."gamesFeitos" IS 'Total de games marcados (apenas gamesTime1 + gamesTime2, sem tie break)';


--
-- TOC entry 4257 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN "RankingPanelinha"."gamesSofridos"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."RankingPanelinha"."gamesSofridos" IS 'Total de games recebidos (apenas gamesTime1 + gamesTime2, sem tie break)';


--
-- TOC entry 4258 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN "RankingPanelinha".posicao; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."RankingPanelinha".posicao IS 'PosiÃ§Ã£o atual no ranking (calculada)';


--
-- TOC entry 237 (class 1259 OID 213205)
-- Name: SaidaCaixa; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."SaidaCaixa" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "pointId" text NOT NULL,
    valor numeric(10,2) NOT NULL,
    descricao text NOT NULL,
    "fornecedorId" text,
    "categoriaSaidaId" text,
    "centroCustoId" text NOT NULL,
    "formaPagamentoId" text NOT NULL,
    observacoes text,
    "dataSaida" timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone DEFAULT now(),
    "createdBy" text,
    "tipoDespesaId" text,
    "aberturaCaixaId" text,
    "createdById" text,
    "updatedById" text
);


ALTER TABLE public."SaidaCaixa" OWNER TO neondb_owner;

--
-- TOC entry 4259 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE "SaidaCaixa"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."SaidaCaixa" IS 'SaÃ­das manuais de caixa vinculadas a fornecedores, categorias e centro de custo';


--
-- TOC entry 4260 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN "SaidaCaixa"."createdById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."SaidaCaixa"."createdById" IS 'ID do usuÃ¡rio que criou a saÃ­da de caixa';


--
-- TOC entry 4261 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN "SaidaCaixa"."updatedById"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."SaidaCaixa"."updatedById" IS 'ID do usuÃ¡rio que fez a Ãºltima atualizaÃ§Ã£o da saÃ­da de caixa';


--
-- TOC entry 225 (class 1259 OID 98620)
-- Name: TabelaPreco; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TabelaPreco" (
    id text NOT NULL,
    "quadraId" text NOT NULL,
    "inicioMinutoDia" integer NOT NULL,
    "fimMinutoDia" integer NOT NULL,
    "valorHora" numeric(10,2) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "valorHoraAula" numeric(10,2) DEFAULT NULL::numeric
);


ALTER TABLE public."TabelaPreco" OWNER TO neondb_owner;

--
-- TOC entry 4262 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN "TabelaPreco"."valorHoraAula"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."TabelaPreco"."valorHoraAula" IS 'Valor de locaÃ§Ã£o por hora para aulas/professores. Se null, usa o mesmo valor de valorHora (atleta).';


--
-- TOC entry 239 (class 1259 OID 245760)
-- Name: TipoDespesa; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."TipoDespesa" (
    id text NOT NULL,
    "pointId" text NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."TipoDespesa" OWNER TO neondb_owner;

--
-- TOC entry 221 (class 1259 OID 41117)
-- Name: Torneio; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Torneio" (
    id text NOT NULL,
    nome text NOT NULL,
    "dataInicio" timestamp(3) without time zone NOT NULL,
    "dataFim" timestamp(3) without time zone
);


ALTER TABLE public."Torneio" OWNER TO neondb_owner;

--
-- TOC entry 218 (class 1259 OID 41062)
-- Name: User; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    password text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    "pointIdGestor" text,
    "aceitaLembretesAgendamento" boolean DEFAULT false,
    "resetToken" text,
    "resetTokenExpiry" timestamp without time zone,
    "ehColaborador" boolean DEFAULT false,
    "gestorId" text
);


ALTER TABLE public."User" OWNER TO neondb_owner;

--
-- TOC entry 4263 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN "User"."aceitaLembretesAgendamento"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."User"."aceitaLembretesAgendamento" IS 'Indica se o usuÃ¡rio aceita receber lembretes de agendamento via WhatsApp. Por padrÃ£o Ã© false (nÃ£o aceita). Admin pode ativar/desativar.';


--
-- TOC entry 4264 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN "User"."ehColaborador"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."User"."ehColaborador" IS 'Indica se o usuÃ¡rio Ã© um colaborador (true) ou gestor (false). Apenas para usuÃ¡rios com role ORGANIZER.';


--
-- TOC entry 4265 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN "User"."gestorId"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public."User"."gestorId" IS 'ID do usuÃ¡rio gestor que criou/gerencia este colaborador. NULL para gestores ou usuÃ¡rios sem gestor.';


--
-- TOC entry 217 (class 1259 OID 41052)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO neondb_owner;

--
-- TOC entry 242 (class 1259 OID 368644)
-- Name: vw_usuarios_pendentes; Type: VIEW; Schema: public; Owner: neondb_owner
--

CREATE VIEW public.vw_usuarios_pendentes AS
 SELECT u.id AS "usuarioId",
    u.name AS "nomeUsuario",
    u.email AS "emailTemporario",
    u.role,
    u."createdAt" AS "dataCriacao",
    a.id AS "atletaId",
    a.nome AS "nomeAtleta",
    a.fone AS telefone,
    public.normalizar_telefone(a.fone) AS "telefoneNormalizado"
   FROM (public."User" u
     JOIN public."Atleta" a ON ((a."usuarioId" = u.id)))
  WHERE ((u.email ~~ 'temp_%@pendente.local'::text) AND (u.password IS NULL));


ALTER VIEW public.vw_usuarios_pendentes OWNER TO neondb_owner;

--
-- TOC entry 4266 (class 0 OID 0)
-- Dependencies: 242
-- Name: VIEW vw_usuarios_pendentes; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON VIEW public.vw_usuarios_pendentes IS 'View para listar usuÃ¡rios pendentes (incompletos) que aguardam vÃ­nculo pelo telefone';


--
-- TOC entry 3540 (class 2604 OID 540679)
-- Name: PlatformConfig id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PlatformConfig" ALTER COLUMN id SET DEFAULT nextval('public."PlatformConfig_id_seq"'::regclass);


--
-- TOC entry 4267 (class 0 OID 0)
-- Dependencies: 258
-- Name: PlatformConfig_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 3699 (class 2606 OID 270345)
-- Name: AberturaCaixa AberturaCaixa_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AberturaCaixa"
    ADD CONSTRAINT "AberturaCaixa_pkey" PRIMARY KEY (id);


--
-- TOC entry 3704 (class 2606 OID 311324)
-- Name: AgendamentoAtleta AgendamentoAtleta_agendamentoId_atletaId_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoAtleta"
    ADD CONSTRAINT "AgendamentoAtleta_agendamentoId_atletaId_key" UNIQUE ("agendamentoId", "atletaId");


--
-- TOC entry 3706 (class 2606 OID 311322)
-- Name: AgendamentoAtleta AgendamentoAtleta_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoAtleta"
    ADD CONSTRAINT "AgendamentoAtleta_pkey" PRIMARY KEY (id);


--
-- TOC entry 3825 (class 2606 OID 565257)
-- Name: AgendamentoParticipante AgendamentoParticipante_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoParticipante"
    ADD CONSTRAINT "AgendamentoParticipante_pkey" PRIMARY KEY (id);


--
-- TOC entry 3589 (class 2606 OID 90398)
-- Name: Agendamento Agendamento_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT "Agendamento_pkey" PRIMARY KEY (id);


--
-- TOC entry 3762 (class 2606 OID 450671)
-- Name: AlunoAula AlunoAula_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoAula"
    ADD CONSTRAINT "AlunoAula_pkey" PRIMARY KEY (id);


--
-- TOC entry 3770 (class 2606 OID 450699)
-- Name: AlunoProfessor AlunoProfessor_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoProfessor"
    ADD CONSTRAINT "AlunoProfessor_pkey" PRIMARY KEY (id);


--
-- TOC entry 3798 (class 2606 OID 483361)
-- Name: AtletaCompeticao AtletaCompeticao_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaCompeticao"
    ADD CONSTRAINT "AtletaCompeticao_pkey" PRIMARY KEY (id);


--
-- TOC entry 3610 (class 2606 OID 163848)
-- Name: AtletaPoint AtletaPoint_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaPoint"
    ADD CONSTRAINT "AtletaPoint_pkey" PRIMARY KEY (id);


--
-- TOC entry 3566 (class 2606 OID 41087)
-- Name: Atleta Atleta_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Atleta"
    ADD CONSTRAINT "Atleta_pkey" PRIMARY KEY (id);


--
-- TOC entry 3752 (class 2606 OID 450641)
-- Name: Aula Aula_agendamentoId_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Aula"
    ADD CONSTRAINT "Aula_agendamentoId_key" UNIQUE ("agendamentoId");


--
-- TOC entry 3754 (class 2606 OID 450639)
-- Name: Aula Aula_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Aula"
    ADD CONSTRAINT "Aula_pkey" PRIMARY KEY (id);


--
-- TOC entry 3777 (class 2606 OID 450726)
-- Name: AvaliacaoAluno AvaliacaoAluno_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AvaliacaoAluno"
    ADD CONSTRAINT "AvaliacaoAluno_pkey" PRIMARY KEY (id);


--
-- TOC entry 3603 (class 2606 OID 139274)
-- Name: BloqueioAgenda BloqueioAgenda_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."BloqueioAgenda"
    ADD CONSTRAINT "BloqueioAgenda_pkey" PRIMARY KEY (id);


--
-- TOC entry 3616 (class 2606 OID 213004)
-- Name: CardCliente CardCliente_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_pkey" PRIMARY KEY (id);


--
-- TOC entry 3618 (class 2606 OID 213006)
-- Name: CardCliente CardCliente_pointId_numeroCard_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_pointId_numeroCard_key" UNIQUE ("pointId", "numeroCard");


--
-- TOC entry 3658 (class 2606 OID 213147)
-- Name: CategoriaSaida CategoriaSaida_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CategoriaSaida"
    ADD CONSTRAINT "CategoriaSaida_pkey" PRIMARY KEY (id);


--
-- TOC entry 3660 (class 2606 OID 213149)
-- Name: CategoriaSaida CategoriaSaida_pointId_nome_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CategoriaSaida"
    ADD CONSTRAINT "CategoriaSaida_pointId_nome_key" UNIQUE ("pointId", nome);


--
-- TOC entry 3664 (class 2606 OID 213167)
-- Name: CentroCusto CentroCusto_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CentroCusto"
    ADD CONSTRAINT "CentroCusto_pkey" PRIMARY KEY (id);


--
-- TOC entry 3666 (class 2606 OID 213169)
-- Name: CentroCusto CentroCusto_pointId_nome_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CentroCusto"
    ADD CONSTRAINT "CentroCusto_pointId_nome_key" UNIQUE ("pointId", nome);


--
-- TOC entry 3791 (class 2606 OID 483341)
-- Name: Competicao Competicao_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Competicao"
    ADD CONSTRAINT "Competicao_pkey" PRIMARY KEY (id);


--
-- TOC entry 3670 (class 2606 OID 213186)
-- Name: EntradaCaixa EntradaCaixa_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EntradaCaixa"
    ADD CONSTRAINT "EntradaCaixa_pkey" PRIMARY KEY (id);


--
-- TOC entry 3638 (class 2606 OID 213081)
-- Name: FormaPagamento FormaPagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."FormaPagamento"
    ADD CONSTRAINT "FormaPagamento_pkey" PRIMARY KEY (id);


--
-- TOC entry 3640 (class 2606 OID 213083)
-- Name: FormaPagamento FormaPagamento_pointId_nome_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."FormaPagamento"
    ADD CONSTRAINT "FormaPagamento_pointId_nome_key" UNIQUE ("pointId", nome);


--
-- TOC entry 3652 (class 2606 OID 213127)
-- Name: Fornecedor Fornecedor_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Fornecedor"
    ADD CONSTRAINT "Fornecedor_pkey" PRIMARY KEY (id);


--
-- TOC entry 3654 (class 2606 OID 213129)
-- Name: Fornecedor Fornecedor_pointId_nome_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Fornecedor"
    ADD CONSTRAINT "Fornecedor_pointId_nome_key" UNIQUE ("pointId", nome);


--
-- TOC entry 3632 (class 2606 OID 213057)
-- Name: ItemCard ItemCard_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ItemCard"
    ADD CONSTRAINT "ItemCard_pkey" PRIMARY KEY (id);


--
-- TOC entry 3806 (class 2606 OID 491534)
-- Name: JogoCompeticao JogoCompeticao_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."JogoCompeticao"
    ADD CONSTRAINT "JogoCompeticao_pkey" PRIMARY KEY (id);


--
-- TOC entry 3710 (class 2606 OID 393230)
-- Name: NotificacaoAgendamento NotificacaoAgendamento_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."NotificacaoAgendamento"
    ADD CONSTRAINT "NotificacaoAgendamento_pkey" PRIMARY KEY (id);


--
-- TOC entry 3644 (class 2606 OID 213099)
-- Name: PagamentoCard PagamentoCard_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoCard"
    ADD CONSTRAINT "PagamentoCard_pkey" PRIMARY KEY (id);


--
-- TOC entry 3737 (class 2606 OID 434189)
-- Name: PagamentoInfinitePay PagamentoInfinitePay_orderId_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoInfinitePay"
    ADD CONSTRAINT "PagamentoInfinitePay_orderId_key" UNIQUE ("orderId");


--
-- TOC entry 3739 (class 2606 OID 434187)
-- Name: PagamentoInfinitePay PagamentoInfinitePay_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoInfinitePay"
    ADD CONSTRAINT "PagamentoInfinitePay_pkey" PRIMARY KEY (id);


--
-- TOC entry 3689 (class 2606 OID 237578)
-- Name: PagamentoItem PagamentoItem_pagamentoCardId_itemCardId_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoItem"
    ADD CONSTRAINT "PagamentoItem_pagamentoCardId_itemCardId_key" UNIQUE ("pagamentoCardId", "itemCardId");


--
-- TOC entry 3691 (class 2606 OID 237576)
-- Name: PagamentoItem PagamentoItem_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoItem"
    ADD CONSTRAINT "PagamentoItem_pkey" PRIMARY KEY (id);


--
-- TOC entry 3718 (class 2606 OID 409623)
-- Name: PanelinhaAtleta PanelinhaAtleta_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PanelinhaAtleta"
    ADD CONSTRAINT "PanelinhaAtleta_pkey" PRIMARY KEY (id);


--
-- TOC entry 3714 (class 2606 OID 409609)
-- Name: Panelinha Panelinha_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Panelinha"
    ADD CONSTRAINT "Panelinha_pkey" PRIMARY KEY (id);


--
-- TOC entry 3724 (class 2606 OID 425992)
-- Name: PartidaPanelinha PartidaPanelinha_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PartidaPanelinha"
    ADD CONSTRAINT "PartidaPanelinha_pkey" PRIMARY KEY (id);


--
-- TOC entry 3573 (class 2606 OID 41106)
-- Name: Partida Partida_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partida"
    ADD CONSTRAINT "Partida_pkey" PRIMARY KEY (id);


--
-- TOC entry 3819 (class 2606 OID 540689)
-- Name: PlatformConfig PlatformConfig_chave_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PlatformConfig"
    ADD CONSTRAINT "PlatformConfig_chave_key" UNIQUE (chave);


--
-- TOC entry 3821 (class 2606 OID 540687)
-- Name: PlatformConfig PlatformConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PlatformConfig"
    ADD CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY (id);


--
-- TOC entry 3579 (class 2606 OID 90379)
-- Name: Point Point_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Point"
    ADD CONSTRAINT "Point_pkey" PRIMARY KEY (id);


--
-- TOC entry 3626 (class 2606 OID 213037)
-- Name: Produto Produto_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_pkey" PRIMARY KEY (id);


--
-- TOC entry 3628 (class 2606 OID 213039)
-- Name: Produto Produto_pointId_nome_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_pointId_nome_key" UNIQUE ("pointId", nome);


--
-- TOC entry 3785 (class 2606 OID 466957)
-- Name: ProfessorPoint ProfessorPoint_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ProfessorPoint"
    ADD CONSTRAINT "ProfessorPoint_pkey" PRIMARY KEY (id);


--
-- TOC entry 3745 (class 2606 OID 450616)
-- Name: Professor Professor_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Professor"
    ADD CONSTRAINT "Professor_pkey" PRIMARY KEY (id);


--
-- TOC entry 3747 (class 2606 OID 450618)
-- Name: Professor Professor_userId_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Professor"
    ADD CONSTRAINT "Professor_userId_key" UNIQUE ("userId");


--
-- TOC entry 3586 (class 2606 OID 90388)
-- Name: Quadra Quadra_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Quadra"
    ADD CONSTRAINT "Quadra_pkey" PRIMARY KEY (id);


--
-- TOC entry 3730 (class 2606 OID 426023)
-- Name: RankingPanelinha RankingPanelinha_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."RankingPanelinha"
    ADD CONSTRAINT "RankingPanelinha_pkey" PRIMARY KEY (id);


--
-- TOC entry 3678 (class 2606 OID 213214)
-- Name: SaidaCaixa SaidaCaixa_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_pkey" PRIMARY KEY (id);


--
-- TOC entry 3600 (class 2606 OID 98628)
-- Name: TabelaPreco TabelaPreco_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."TabelaPreco"
    ADD CONSTRAINT "TabelaPreco_pkey" PRIMARY KEY (id);


--
-- TOC entry 3695 (class 2606 OID 245769)
-- Name: TipoDespesa TipoDespesa_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."TipoDespesa"
    ADD CONSTRAINT "TipoDespesa_pkey" PRIMARY KEY (id);


--
-- TOC entry 3697 (class 2606 OID 245771)
-- Name: TipoDespesa TipoDespesa_pointId_nome_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."TipoDespesa"
    ADD CONSTRAINT "TipoDespesa_pointId_nome_key" UNIQUE ("pointId", nome);


--
-- TOC entry 3577 (class 2606 OID 41123)
-- Name: Torneio Torneio_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Torneio"
    ADD CONSTRAINT "Torneio_pkey" PRIMARY KEY (id);


--
-- TOC entry 3559 (class 2606 OID 49319)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 3556 (class 2606 OID 41060)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3829 (class 2606 OID 565259)
-- Name: AgendamentoParticipante uk_agendamento_atleta; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoParticipante"
    ADD CONSTRAINT uk_agendamento_atleta UNIQUE ("agendamentoId", "atletaId");


--
-- TOC entry 3768 (class 2606 OID 450673)
-- Name: AlunoAula uk_aluno_aula_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoAula"
    ADD CONSTRAINT uk_aluno_aula_unique UNIQUE ("aulaId", "atletaId");


--
-- TOC entry 3775 (class 2606 OID 450701)
-- Name: AlunoProfessor uk_aluno_professor_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoProfessor"
    ADD CONSTRAINT uk_aluno_professor_unique UNIQUE ("professorId", "atletaId");


--
-- TOC entry 3614 (class 2606 OID 163850)
-- Name: AtletaPoint uk_atleta_point; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaPoint"
    ADD CONSTRAINT uk_atleta_point UNIQUE ("atletaId", "pointId");


--
-- TOC entry 3783 (class 2606 OID 450728)
-- Name: AvaliacaoAluno uk_avaliacao_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AvaliacaoAluno"
    ADD CONSTRAINT uk_avaliacao_unique UNIQUE ("aulaId", "atletaId");


--
-- TOC entry 3817 (class 2606 OID 491536)
-- Name: JogoCompeticao uk_jogo_competicao_rodada_numero; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."JogoCompeticao"
    ADD CONSTRAINT uk_jogo_competicao_rodada_numero UNIQUE ("competicaoId", rodada, "numeroJogo");


--
-- TOC entry 3722 (class 2606 OID 409625)
-- Name: PanelinhaAtleta uk_panelinha_atleta_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PanelinhaAtleta"
    ADD CONSTRAINT uk_panelinha_atleta_unique UNIQUE ("panelinhaId", "atletaId");


--
-- TOC entry 3728 (class 2606 OID 425994)
-- Name: PartidaPanelinha uk_partida_panelinha_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PartidaPanelinha"
    ADD CONSTRAINT uk_partida_panelinha_unique UNIQUE ("partidaId", "panelinhaId");


--
-- TOC entry 3789 (class 2606 OID 466959)
-- Name: ProfessorPoint uk_professor_point_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ProfessorPoint"
    ADD CONSTRAINT uk_professor_point_unique UNIQUE ("professorId", "pointId");


--
-- TOC entry 3735 (class 2606 OID 426025)
-- Name: RankingPanelinha uk_ranking_panelinha_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."RankingPanelinha"
    ADD CONSTRAINT uk_ranking_panelinha_unique UNIQUE ("panelinhaId", "atletaId");


--
-- TOC entry 3587 (class 1259 OID 90872)
-- Name: Agendamento_atletaId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Agendamento_atletaId_idx" ON public."Agendamento" USING btree ("atletaId");


--
-- TOC entry 3590 (class 1259 OID 90399)
-- Name: Agendamento_quadraId_dataHora_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Agendamento_quadraId_dataHora_idx" ON public."Agendamento" USING btree ("quadraId", "dataHora");


--
-- TOC entry 3591 (class 1259 OID 90400)
-- Name: Agendamento_usuarioId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Agendamento_usuarioId_idx" ON public."Agendamento" USING btree ("usuarioId");


--
-- TOC entry 3601 (class 1259 OID 98629)
-- Name: TabelaPreco_quadraId_inicioMinutoDia_fimMinutoDia_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "TabelaPreco_quadraId_inicioMinutoDia_fimMinutoDia_idx" ON public."TabelaPreco" USING btree ("quadraId", "inicioMinutoDia", "fimMinutoDia");


--
-- TOC entry 3557 (class 1259 OID 41071)
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- TOC entry 3645 (class 1259 OID 434209)
-- Name: idx_PagamentoCard_infinitePayOrderId; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "idx_PagamentoCard_infinitePayOrderId" ON public."PagamentoCard" USING btree ("infinitePayOrderId");


--
-- TOC entry 3740 (class 1259 OID 434205)
-- Name: idx_PagamentoInfinitePay_cardId; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "idx_PagamentoInfinitePay_cardId" ON public."PagamentoInfinitePay" USING btree ("cardId");


--
-- TOC entry 3741 (class 1259 OID 434208)
-- Name: idx_PagamentoInfinitePay_createdAt; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "idx_PagamentoInfinitePay_createdAt" ON public."PagamentoInfinitePay" USING btree ("createdAt");


--
-- TOC entry 3742 (class 1259 OID 434206)
-- Name: idx_PagamentoInfinitePay_orderId; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "idx_PagamentoInfinitePay_orderId" ON public."PagamentoInfinitePay" USING btree ("orderId");


--
-- TOC entry 3743 (class 1259 OID 434207)
-- Name: idx_PagamentoInfinitePay_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "idx_PagamentoInfinitePay_status" ON public."PagamentoInfinitePay" USING btree (status);


--
-- TOC entry 3580 (class 1259 OID 434210)
-- Name: idx_Point_infinitePayHandle; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "idx_Point_infinitePayHandle" ON public."Point" USING btree ("infinitePayHandle") WHERE ("infinitePayHandle" IS NOT NULL);


--
-- TOC entry 3700 (class 1259 OID 622693)
-- Name: idx_abertura_caixa_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_abertura_caixa_created_by_id ON public."AberturaCaixa" USING btree ("createdById");


--
-- TOC entry 3701 (class 1259 OID 270361)
-- Name: idx_abertura_caixa_point_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_abertura_caixa_point_status ON public."AberturaCaixa" USING btree ("pointId", status);


--
-- TOC entry 3702 (class 1259 OID 622699)
-- Name: idx_abertura_caixa_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_abertura_caixa_updated_by_id ON public."AberturaCaixa" USING btree ("updatedById");


--
-- TOC entry 3707 (class 1259 OID 311340)
-- Name: idx_agendamento_atleta_agendamento; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_atleta_agendamento ON public."AgendamentoAtleta" USING btree ("agendamentoId");


--
-- TOC entry 3708 (class 1259 OID 311341)
-- Name: idx_agendamento_atleta_atleta; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_atleta_atleta ON public."AgendamentoAtleta" USING btree ("atletaId");


--
-- TOC entry 3592 (class 1259 OID 532485)
-- Name: idx_agendamento_competicao_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_competicao_id ON public."Agendamento" USING btree ("competicaoId");


--
-- TOC entry 3593 (class 1259 OID 622602)
-- Name: idx_agendamento_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_created_by_id ON public."Agendamento" USING btree ("createdById");


--
-- TOC entry 3594 (class 1259 OID 475143)
-- Name: idx_agendamento_eh_aula; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_eh_aula ON public."Agendamento" USING btree ("ehAula");


--
-- TOC entry 3826 (class 1259 OID 565270)
-- Name: idx_agendamento_participante_agendamento; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_participante_agendamento ON public."AgendamentoParticipante" USING btree ("agendamentoId");


--
-- TOC entry 3827 (class 1259 OID 565271)
-- Name: idx_agendamento_participante_atleta; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_participante_atleta ON public."AgendamentoParticipante" USING btree ("atletaId");


--
-- TOC entry 3595 (class 1259 OID 475142)
-- Name: idx_agendamento_professor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_professor_id ON public."Agendamento" USING btree ("professorId");


--
-- TOC entry 3596 (class 1259 OID 114689)
-- Name: idx_agendamento_recorrencia_data; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_recorrencia_data ON public."Agendamento" USING btree ("recorrenciaId", "dataHora");


--
-- TOC entry 3597 (class 1259 OID 114688)
-- Name: idx_agendamento_recorrencia_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_recorrencia_id ON public."Agendamento" USING btree ("recorrenciaId");


--
-- TOC entry 3598 (class 1259 OID 622603)
-- Name: idx_agendamento_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_agendamento_updated_by_id ON public."Agendamento" USING btree ("updatedById");


--
-- TOC entry 3763 (class 1259 OID 450685)
-- Name: idx_aluno_aula_atleta_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aluno_aula_atleta_id ON public."AlunoAula" USING btree ("atletaId");


--
-- TOC entry 3764 (class 1259 OID 450684)
-- Name: idx_aluno_aula_aula_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aluno_aula_aula_id ON public."AlunoAula" USING btree ("aulaId");


--
-- TOC entry 3765 (class 1259 OID 450687)
-- Name: idx_aluno_aula_presenca; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aluno_aula_presenca ON public."AlunoAula" USING btree (presenca);


--
-- TOC entry 3766 (class 1259 OID 450686)
-- Name: idx_aluno_aula_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aluno_aula_status ON public."AlunoAula" USING btree ("statusInscricao");


--
-- TOC entry 3771 (class 1259 OID 450714)
-- Name: idx_aluno_professor_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aluno_professor_ativo ON public."AlunoProfessor" USING btree (ativo);


--
-- TOC entry 3772 (class 1259 OID 450713)
-- Name: idx_aluno_professor_atleta_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aluno_professor_atleta_id ON public."AlunoProfessor" USING btree ("atletaId");


--
-- TOC entry 3773 (class 1259 OID 450712)
-- Name: idx_aluno_professor_professor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aluno_professor_professor_id ON public."AlunoProfessor" USING btree ("professorId");


--
-- TOC entry 3567 (class 1259 OID 393220)
-- Name: idx_atleta_aceita_lembretes; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_aceita_lembretes ON public."Atleta" USING btree ("aceitaLembretesAgendamento") WHERE ("aceitaLembretesAgendamento" = true);


--
-- TOC entry 3568 (class 1259 OID 319491)
-- Name: idx_atleta_assinante; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_assinante ON public."Atleta" USING btree (assinante) WHERE (assinante = true);


--
-- TOC entry 3799 (class 1259 OID 483383)
-- Name: idx_atleta_competicao_atleta_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_competicao_atleta_id ON public."AtletaCompeticao" USING btree ("atletaId");


--
-- TOC entry 3800 (class 1259 OID 516096)
-- Name: idx_atleta_competicao_competicao_atleta; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_competicao_competicao_atleta ON public."AtletaCompeticao" USING btree ("competicaoId", "atletaId");


--
-- TOC entry 3801 (class 1259 OID 483382)
-- Name: idx_atleta_competicao_competicao_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_competicao_competicao_id ON public."AtletaCompeticao" USING btree ("competicaoId");


--
-- TOC entry 3802 (class 1259 OID 622650)
-- Name: idx_atleta_competicao_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_competicao_created_by_id ON public."AtletaCompeticao" USING btree ("createdById");


--
-- TOC entry 3803 (class 1259 OID 483384)
-- Name: idx_atleta_competicao_parceria_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_competicao_parceria_id ON public."AtletaCompeticao" USING btree ("parceriaId") WHERE ("parceriaId" IS NOT NULL);


--
-- TOC entry 3804 (class 1259 OID 622651)
-- Name: idx_atleta_competicao_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_competicao_updated_by_id ON public."AtletaCompeticao" USING btree ("updatedById");


--
-- TOC entry 3569 (class 1259 OID 368640)
-- Name: idx_atleta_fone_normalizado; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_fone_normalizado ON public."Atleta" USING btree (regexp_replace(fone, '[^0-9]'::text, ''::text, 'g'::text));


--
-- TOC entry 3611 (class 1259 OID 163861)
-- Name: idx_atleta_point_atleta; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_point_atleta ON public."AtletaPoint" USING btree ("atletaId");


--
-- TOC entry 3612 (class 1259 OID 163862)
-- Name: idx_atleta_point_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_point_point ON public."AtletaPoint" USING btree ("pointId");


--
-- TOC entry 3570 (class 1259 OID 163863)
-- Name: idx_atleta_point_principal; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_point_principal ON public."Atleta" USING btree ("pointIdPrincipal");


--
-- TOC entry 3571 (class 1259 OID 368641)
-- Name: idx_atleta_usuario_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_atleta_usuario_id ON public."Atleta" USING btree ("usuarioId") WHERE ("usuarioId" IS NOT NULL);


--
-- TOC entry 3755 (class 1259 OID 450653)
-- Name: idx_aula_agendamento_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aula_agendamento_id ON public."Aula" USING btree ("agendamentoId");


--
-- TOC entry 3756 (class 1259 OID 450655)
-- Name: idx_aula_data_inicio; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aula_data_inicio ON public."Aula" USING btree ("dataInicio");


--
-- TOC entry 3757 (class 1259 OID 450657)
-- Name: idx_aula_professor_data; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aula_professor_data ON public."Aula" USING btree ("professorId", "dataInicio");


--
-- TOC entry 3758 (class 1259 OID 450652)
-- Name: idx_aula_professor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aula_professor_id ON public."Aula" USING btree ("professorId");


--
-- TOC entry 3759 (class 1259 OID 450656)
-- Name: idx_aula_recorrencia_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aula_recorrencia_id ON public."Aula" USING btree ("recorrenciaId");


--
-- TOC entry 3760 (class 1259 OID 450654)
-- Name: idx_aula_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_aula_status ON public."Aula" USING btree (status);


--
-- TOC entry 3778 (class 1259 OID 450745)
-- Name: idx_avaliacao_atleta_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_avaliacao_atleta_id ON public."AvaliacaoAluno" USING btree ("atletaId");


--
-- TOC entry 3779 (class 1259 OID 450746)
-- Name: idx_avaliacao_aula_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_avaliacao_aula_id ON public."AvaliacaoAluno" USING btree ("aulaId");


--
-- TOC entry 3780 (class 1259 OID 450747)
-- Name: idx_avaliacao_avaliado_em; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_avaliacao_avaliado_em ON public."AvaliacaoAluno" USING btree ("avaliadoEm");


--
-- TOC entry 3781 (class 1259 OID 450744)
-- Name: idx_avaliacao_professor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_avaliacao_professor_id ON public."AvaliacaoAluno" USING btree ("professorId");


--
-- TOC entry 3604 (class 1259 OID 139283)
-- Name: idx_bloqueio_agenda_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bloqueio_agenda_ativo ON public."BloqueioAgenda" USING btree (ativo);


--
-- TOC entry 3605 (class 1259 OID 139282)
-- Name: idx_bloqueio_agenda_data_fim; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bloqueio_agenda_data_fim ON public."BloqueioAgenda" USING btree ("dataFim");


--
-- TOC entry 3606 (class 1259 OID 139281)
-- Name: idx_bloqueio_agenda_data_inicio; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bloqueio_agenda_data_inicio ON public."BloqueioAgenda" USING btree ("dataInicio");


--
-- TOC entry 3607 (class 1259 OID 139280)
-- Name: idx_bloqueio_agenda_point_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bloqueio_agenda_point_id ON public."BloqueioAgenda" USING btree ("pointId");


--
-- TOC entry 3608 (class 1259 OID 139284)
-- Name: idx_bloqueio_agenda_quadra_ids; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bloqueio_agenda_quadra_ids ON public."BloqueioAgenda" USING gin ("quadraIds");


--
-- TOC entry 3619 (class 1259 OID 622609)
-- Name: idx_card_cliente_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_card_cliente_created_by_id ON public."CardCliente" USING btree ("createdById");


--
-- TOC entry 3620 (class 1259 OID 213024)
-- Name: idx_card_cliente_numero; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_card_cliente_numero ON public."CardCliente" USING btree ("numeroCard");


--
-- TOC entry 3621 (class 1259 OID 213022)
-- Name: idx_card_cliente_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_card_cliente_point ON public."CardCliente" USING btree ("pointId");


--
-- TOC entry 3622 (class 1259 OID 213023)
-- Name: idx_card_cliente_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_card_cliente_status ON public."CardCliente" USING btree (status);


--
-- TOC entry 3623 (class 1259 OID 622615)
-- Name: idx_card_cliente_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_card_cliente_updated_by_id ON public."CardCliente" USING btree ("updatedById");


--
-- TOC entry 3624 (class 1259 OID 221189)
-- Name: idx_card_cliente_usuario; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_card_cliente_usuario ON public."CardCliente" USING btree ("usuarioId");


--
-- TOC entry 3661 (class 1259 OID 213156)
-- Name: idx_categoria_saida_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_categoria_saida_ativo ON public."CategoriaSaida" USING btree (ativo);


--
-- TOC entry 3662 (class 1259 OID 213155)
-- Name: idx_categoria_saida_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_categoria_saida_point ON public."CategoriaSaida" USING btree ("pointId");


--
-- TOC entry 3667 (class 1259 OID 213176)
-- Name: idx_centro_custo_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_centro_custo_ativo ON public."CentroCusto" USING btree (ativo);


--
-- TOC entry 3668 (class 1259 OID 213175)
-- Name: idx_centro_custo_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_centro_custo_point ON public."CentroCusto" USING btree ("pointId");


--
-- TOC entry 3792 (class 1259 OID 622626)
-- Name: idx_competicao_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_competicao_created_by_id ON public."Competicao" USING btree ("createdById");


--
-- TOC entry 3793 (class 1259 OID 483379)
-- Name: idx_competicao_point_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_competicao_point_id ON public."Competicao" USING btree ("pointId");


--
-- TOC entry 3794 (class 1259 OID 483380)
-- Name: idx_competicao_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_competicao_status ON public."Competicao" USING btree (status);


--
-- TOC entry 3795 (class 1259 OID 483381)
-- Name: idx_competicao_tipo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_competicao_tipo ON public."Competicao" USING btree (tipo);


--
-- TOC entry 3796 (class 1259 OID 622627)
-- Name: idx_competicao_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_competicao_updated_by_id ON public."Competicao" USING btree ("updatedById");


--
-- TOC entry 3671 (class 1259 OID 270362)
-- Name: idx_entrada_caixa_abertura; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_entrada_caixa_abertura ON public."EntradaCaixa" USING btree ("aberturaCaixaId");


--
-- TOC entry 3672 (class 1259 OID 622657)
-- Name: idx_entrada_caixa_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_entrada_caixa_created_by_id ON public."EntradaCaixa" USING btree ("createdById");


--
-- TOC entry 3673 (class 1259 OID 213203)
-- Name: idx_entrada_caixa_data; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_entrada_caixa_data ON public."EntradaCaixa" USING btree ("dataEntrada");


--
-- TOC entry 3674 (class 1259 OID 213204)
-- Name: idx_entrada_caixa_forma; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_entrada_caixa_forma ON public."EntradaCaixa" USING btree ("formaPagamentoId");


--
-- TOC entry 3675 (class 1259 OID 213202)
-- Name: idx_entrada_caixa_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_entrada_caixa_point ON public."EntradaCaixa" USING btree ("pointId");


--
-- TOC entry 3676 (class 1259 OID 622663)
-- Name: idx_entrada_caixa_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_entrada_caixa_updated_by_id ON public."EntradaCaixa" USING btree ("updatedById");


--
-- TOC entry 3641 (class 1259 OID 213090)
-- Name: idx_forma_pagamento_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_forma_pagamento_ativo ON public."FormaPagamento" USING btree (ativo);


--
-- TOC entry 3642 (class 1259 OID 213089)
-- Name: idx_forma_pagamento_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_forma_pagamento_point ON public."FormaPagamento" USING btree ("pointId");


--
-- TOC entry 3655 (class 1259 OID 213136)
-- Name: idx_fornecedor_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_fornecedor_ativo ON public."Fornecedor" USING btree (ativo);


--
-- TOC entry 3656 (class 1259 OID 213135)
-- Name: idx_fornecedor_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_fornecedor_point ON public."Fornecedor" USING btree ("pointId");


--
-- TOC entry 3633 (class 1259 OID 213068)
-- Name: idx_item_card_card; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_item_card_card ON public."ItemCard" USING btree ("cardId");


--
-- TOC entry 3634 (class 1259 OID 630789)
-- Name: idx_item_card_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_item_card_created_by_id ON public."ItemCard" USING btree ("createdById");


--
-- TOC entry 3635 (class 1259 OID 213069)
-- Name: idx_item_card_produto; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_item_card_produto ON public."ItemCard" USING btree ("produtoId");


--
-- TOC entry 3636 (class 1259 OID 630795)
-- Name: idx_item_card_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_item_card_updated_by_id ON public."ItemCard" USING btree ("updatedById");


--
-- TOC entry 3807 (class 1259 OID 491549)
-- Name: idx_jogo_competicao_atleta1; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_atleta1 ON public."JogoCompeticao" USING btree ("atleta1Id") WHERE ("atleta1Id" IS NOT NULL);


--
-- TOC entry 3808 (class 1259 OID 491550)
-- Name: idx_jogo_competicao_atleta2; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_atleta2 ON public."JogoCompeticao" USING btree ("atleta2Id") WHERE ("atleta2Id" IS NOT NULL);


--
-- TOC entry 3809 (class 1259 OID 589824)
-- Name: idx_jogo_competicao_atleta3; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_atleta3 ON public."JogoCompeticao" USING btree ("atleta3Id") WHERE ("atleta3Id" IS NOT NULL);


--
-- TOC entry 3810 (class 1259 OID 589825)
-- Name: idx_jogo_competicao_atleta4; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_atleta4 ON public."JogoCompeticao" USING btree ("atleta4Id") WHERE ("atleta4Id" IS NOT NULL);


--
-- TOC entry 3811 (class 1259 OID 491547)
-- Name: idx_jogo_competicao_competicao_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_competicao_id ON public."JogoCompeticao" USING btree ("competicaoId");


--
-- TOC entry 3812 (class 1259 OID 622638)
-- Name: idx_jogo_competicao_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_created_by_id ON public."JogoCompeticao" USING btree ("createdById");


--
-- TOC entry 3813 (class 1259 OID 491548)
-- Name: idx_jogo_competicao_rodada; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_rodada ON public."JogoCompeticao" USING btree ("competicaoId", rodada);


--
-- TOC entry 3814 (class 1259 OID 491551)
-- Name: idx_jogo_competicao_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_status ON public."JogoCompeticao" USING btree (status);


--
-- TOC entry 3815 (class 1259 OID 622639)
-- Name: idx_jogo_competicao_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_jogo_competicao_updated_by_id ON public."JogoCompeticao" USING btree ("updatedById");


--
-- TOC entry 3711 (class 1259 OID 393236)
-- Name: idx_notificacao_agendamento_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notificacao_agendamento_id ON public."NotificacaoAgendamento" USING btree ("agendamentoId", tipo, enviada);


--
-- TOC entry 3712 (class 1259 OID 393237)
-- Name: idx_notificacao_agendamento_tipo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notificacao_agendamento_tipo ON public."NotificacaoAgendamento" USING btree (tipo, enviada);


--
-- TOC entry 3646 (class 1259 OID 278533)
-- Name: idx_pagamento_card_abertura; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_pagamento_card_abertura ON public."PagamentoCard" USING btree ("aberturaCaixaId");


--
-- TOC entry 3647 (class 1259 OID 213115)
-- Name: idx_pagamento_card_card; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_pagamento_card_card ON public."PagamentoCard" USING btree ("cardId");


--
-- TOC entry 3648 (class 1259 OID 622681)
-- Name: idx_pagamento_card_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_pagamento_card_created_by_id ON public."PagamentoCard" USING btree ("createdById");


--
-- TOC entry 3649 (class 1259 OID 213116)
-- Name: idx_pagamento_card_forma; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_pagamento_card_forma ON public."PagamentoCard" USING btree ("formaPagamentoId");


--
-- TOC entry 3650 (class 1259 OID 622687)
-- Name: idx_pagamento_card_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_pagamento_card_updated_by_id ON public."PagamentoCard" USING btree ("updatedById");


--
-- TOC entry 3692 (class 1259 OID 237590)
-- Name: idx_pagamento_item_item; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_pagamento_item_item ON public."PagamentoItem" USING btree ("itemCardId");


--
-- TOC entry 3693 (class 1259 OID 237589)
-- Name: idx_pagamento_item_pagamento; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_pagamento_item_pagamento ON public."PagamentoItem" USING btree ("pagamentoCardId");


--
-- TOC entry 3719 (class 1259 OID 409638)
-- Name: idx_panelinha_atleta_atleta; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_panelinha_atleta_atleta ON public."PanelinhaAtleta" USING btree ("atletaId");


--
-- TOC entry 3715 (class 1259 OID 409636)
-- Name: idx_panelinha_atleta_criador; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_panelinha_atleta_criador ON public."Panelinha" USING btree ("atletaIdCriador");


--
-- TOC entry 3720 (class 1259 OID 409637)
-- Name: idx_panelinha_atleta_panelinha; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_panelinha_atleta_panelinha ON public."PanelinhaAtleta" USING btree ("panelinhaId");


--
-- TOC entry 3716 (class 1259 OID 417792)
-- Name: idx_panelinha_esporte; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_panelinha_esporte ON public."Panelinha" USING btree (esporte) WHERE (esporte IS NOT NULL);


--
-- TOC entry 3574 (class 1259 OID 188417)
-- Name: idx_partida_card_url; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_partida_card_url ON public."Partida" USING btree ("cardUrl") WHERE ("cardUrl" IS NOT NULL);


--
-- TOC entry 3725 (class 1259 OID 426006)
-- Name: idx_partida_panelinha_panelinha; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_partida_panelinha_panelinha ON public."PartidaPanelinha" USING btree ("panelinhaId");


--
-- TOC entry 3726 (class 1259 OID 426005)
-- Name: idx_partida_panelinha_partida; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_partida_panelinha_partida ON public."PartidaPanelinha" USING btree ("partidaId");


--
-- TOC entry 3575 (class 1259 OID 196608)
-- Name: idx_partida_templateUrl; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "idx_partida_templateUrl" ON public."Partida" USING btree ("templateUrl") WHERE ("templateUrl" IS NOT NULL);


--
-- TOC entry 3822 (class 1259 OID 540691)
-- Name: idx_platform_config_categoria; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_platform_config_categoria ON public."PlatformConfig" USING btree (categoria);


--
-- TOC entry 3823 (class 1259 OID 540690)
-- Name: idx_platform_config_chave; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_platform_config_chave ON public."PlatformConfig" USING btree (chave);


--
-- TOC entry 3581 (class 1259 OID 319490)
-- Name: idx_point_assinante; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_point_assinante ON public."Point" USING btree (assinante) WHERE (assinante = true);


--
-- TOC entry 3582 (class 1259 OID 344065)
-- Name: idx_point_gzappy_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_point_gzappy_ativo ON public."Point" USING btree ("gzappyAtivo") WHERE ("gzappyAtivo" = true);


--
-- TOC entry 3583 (class 1259 OID 393218)
-- Name: idx_point_lembretes_agendamento; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_point_lembretes_agendamento ON public."Point" USING btree ("enviarLembretesAgendamento", "antecedenciaLembrete") WHERE ("enviarLembretesAgendamento" = true);


--
-- TOC entry 3584 (class 1259 OID 286722)
-- Name: idx_point_whatsapp_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_point_whatsapp_ativo ON public."Point" USING btree ("whatsappAtivo") WHERE ("whatsappAtivo" = true);


--
-- TOC entry 3629 (class 1259 OID 213046)
-- Name: idx_produto_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_produto_ativo ON public."Produto" USING btree (ativo);


--
-- TOC entry 3630 (class 1259 OID 213045)
-- Name: idx_produto_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_produto_point ON public."Produto" USING btree ("pointId");


--
-- TOC entry 3748 (class 1259 OID 450625)
-- Name: idx_professor_ativo; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_professor_ativo ON public."Professor" USING btree (ativo);


--
-- TOC entry 3749 (class 1259 OID 466970)
-- Name: idx_professor_point_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_professor_point_id ON public."Professor" USING btree ("pointIdPrincipal");


--
-- TOC entry 3786 (class 1259 OID 466972)
-- Name: idx_professor_point_point_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_professor_point_point_id ON public."ProfessorPoint" USING btree ("pointId");


--
-- TOC entry 3787 (class 1259 OID 466971)
-- Name: idx_professor_point_professor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_professor_point_professor_id ON public."ProfessorPoint" USING btree ("professorId");


--
-- TOC entry 3750 (class 1259 OID 450624)
-- Name: idx_professor_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_professor_user_id ON public."Professor" USING btree ("userId");


--
-- TOC entry 3731 (class 1259 OID 426037)
-- Name: idx_ranking_panelinha_atleta; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_ranking_panelinha_atleta ON public."RankingPanelinha" USING btree ("atletaId");


--
-- TOC entry 3732 (class 1259 OID 426036)
-- Name: idx_ranking_panelinha_panelinha; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_ranking_panelinha_panelinha ON public."RankingPanelinha" USING btree ("panelinhaId");


--
-- TOC entry 3733 (class 1259 OID 426038)
-- Name: idx_ranking_panelinha_posicao; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_ranking_panelinha_posicao ON public."RankingPanelinha" USING btree ("panelinhaId", posicao);


--
-- TOC entry 3679 (class 1259 OID 270363)
-- Name: idx_saida_caixa_abertura; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_abertura ON public."SaidaCaixa" USING btree ("aberturaCaixaId");


--
-- TOC entry 3680 (class 1259 OID 213248)
-- Name: idx_saida_caixa_categoria; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_categoria ON public."SaidaCaixa" USING btree ("categoriaSaidaId");


--
-- TOC entry 3681 (class 1259 OID 213249)
-- Name: idx_saida_caixa_centro; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_centro ON public."SaidaCaixa" USING btree ("centroCustoId");


--
-- TOC entry 3682 (class 1259 OID 622669)
-- Name: idx_saida_caixa_created_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_created_by_id ON public."SaidaCaixa" USING btree ("createdById");


--
-- TOC entry 3683 (class 1259 OID 213246)
-- Name: idx_saida_caixa_data; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_data ON public."SaidaCaixa" USING btree ("dataSaida");


--
-- TOC entry 3684 (class 1259 OID 213250)
-- Name: idx_saida_caixa_forma; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_forma ON public."SaidaCaixa" USING btree ("formaPagamentoId");


--
-- TOC entry 3685 (class 1259 OID 213247)
-- Name: idx_saida_caixa_fornecedor; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_fornecedor ON public."SaidaCaixa" USING btree ("fornecedorId");


--
-- TOC entry 3686 (class 1259 OID 213245)
-- Name: idx_saida_caixa_point; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_point ON public."SaidaCaixa" USING btree ("pointId");


--
-- TOC entry 3687 (class 1259 OID 622675)
-- Name: idx_saida_caixa_updated_by_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saida_caixa_updated_by_id ON public."SaidaCaixa" USING btree ("updatedById");


--
-- TOC entry 3560 (class 1259 OID 401409)
-- Name: idx_user_aceita_lembretes; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_aceita_lembretes ON public."User" USING btree ("aceitaLembretesAgendamento") WHERE ("aceitaLembretesAgendamento" = true);


--
-- TOC entry 3561 (class 1259 OID 614406)
-- Name: idx_user_eh_colaborador; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_eh_colaborador ON public."User" USING btree ("ehColaborador") WHERE ("ehColaborador" = true);


--
-- TOC entry 3562 (class 1259 OID 368642)
-- Name: idx_user_email_pendente; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_email_pendente ON public."User" USING btree (email) WHERE (email ~~ 'temp_%@pendente.local'::text);


--
-- TOC entry 3563 (class 1259 OID 614407)
-- Name: idx_user_gestor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_gestor_id ON public."User" USING btree ("gestorId");


--
-- TOC entry 3564 (class 1259 OID 540674)
-- Name: idx_user_reset_token; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_reset_token ON public."User" USING btree ("resetToken") WHERE ("resetToken" IS NOT NULL);


--
-- TOC entry 3949 (class 2620 OID 507905)
-- Name: AtletaCompeticao trigger_update_atleta_competicao_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER trigger_update_atleta_competicao_updated_at BEFORE UPDATE ON public."AtletaCompeticao" FOR EACH ROW EXECUTE FUNCTION public.update_competicao_updated_at();


--
-- TOC entry 3935 (class 2620 OID 139286)
-- Name: BloqueioAgenda trigger_update_bloqueio_agenda_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER trigger_update_bloqueio_agenda_updated_at BEFORE UPDATE ON public."BloqueioAgenda" FOR EACH ROW EXECUTE FUNCTION public.update_bloqueio_agenda_updated_at();


--
-- TOC entry 3948 (class 2620 OID 483386)
-- Name: Competicao trigger_update_competicao_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER trigger_update_competicao_updated_at BEFORE UPDATE ON public."Competicao" FOR EACH ROW EXECUTE FUNCTION public.update_competicao_updated_at();


--
-- TOC entry 3950 (class 2620 OID 491552)
-- Name: JogoCompeticao trigger_update_jogo_competicao_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER trigger_update_jogo_competicao_updated_at BEFORE UPDATE ON public."JogoCompeticao" FOR EACH ROW EXECUTE FUNCTION public.update_competicao_updated_at();


--
-- TOC entry 3945 (class 2620 OID 450750)
-- Name: AlunoAula update_aluno_aula_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_aluno_aula_updated_at BEFORE UPDATE ON public."AlunoAula" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3946 (class 2620 OID 450751)
-- Name: AlunoProfessor update_aluno_professor_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_aluno_professor_updated_at BEFORE UPDATE ON public."AlunoProfessor" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3944 (class 2620 OID 450749)
-- Name: Aula update_aula_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_aula_updated_at BEFORE UPDATE ON public."Aula" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3947 (class 2620 OID 450752)
-- Name: AvaliacaoAluno update_avaliacao_aluno_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_avaliacao_aluno_updated_at BEFORE UPDATE ON public."AvaliacaoAluno" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3936 (class 2620 OID 213252)
-- Name: CardCliente update_card_cliente_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_card_cliente_updated_at BEFORE UPDATE ON public."CardCliente" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3941 (class 2620 OID 213257)
-- Name: CategoriaSaida update_categoria_saida_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_categoria_saida_updated_at BEFORE UPDATE ON public."CategoriaSaida" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3942 (class 2620 OID 213258)
-- Name: CentroCusto update_centro_custo_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_centro_custo_updated_at BEFORE UPDATE ON public."CentroCusto" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3939 (class 2620 OID 213255)
-- Name: FormaPagamento update_forma_pagamento_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_forma_pagamento_updated_at BEFORE UPDATE ON public."FormaPagamento" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3940 (class 2620 OID 213256)
-- Name: Fornecedor update_fornecedor_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_fornecedor_updated_at BEFORE UPDATE ON public."Fornecedor" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3938 (class 2620 OID 213254)
-- Name: ItemCard update_item_card_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_item_card_updated_at BEFORE UPDATE ON public."ItemCard" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3937 (class 2620 OID 213253)
-- Name: Produto update_produto_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_produto_updated_at BEFORE UPDATE ON public."Produto" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3943 (class 2620 OID 450748)
-- Name: Professor update_professor_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_professor_updated_at BEFORE UPDATE ON public."Professor" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3890 (class 2606 OID 622688)
-- Name: AberturaCaixa AberturaCaixa_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AberturaCaixa"
    ADD CONSTRAINT "AberturaCaixa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3891 (class 2606 OID 270346)
-- Name: AberturaCaixa AberturaCaixa_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AberturaCaixa"
    ADD CONSTRAINT "AberturaCaixa_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3892 (class 2606 OID 622694)
-- Name: AberturaCaixa AberturaCaixa_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AberturaCaixa"
    ADD CONSTRAINT "AberturaCaixa_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3893 (class 2606 OID 311325)
-- Name: AgendamentoAtleta AgendamentoAtleta_agendamentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoAtleta"
    ADD CONSTRAINT "AgendamentoAtleta_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES public."Agendamento"(id) ON DELETE CASCADE;


--
-- TOC entry 3894 (class 2606 OID 311330)
-- Name: AgendamentoAtleta AgendamentoAtleta_atletaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoAtleta"
    ADD CONSTRAINT "AgendamentoAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3895 (class 2606 OID 311335)
-- Name: AgendamentoAtleta AgendamentoAtleta_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoAtleta"
    ADD CONSTRAINT "AgendamentoAtleta_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id);


--
-- TOC entry 3839 (class 2606 OID 90873)
-- Name: Agendamento Agendamento_atletaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT "Agendamento_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3840 (class 2606 OID 622592)
-- Name: Agendamento Agendamento_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT "Agendamento_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3841 (class 2606 OID 90406)
-- Name: Agendamento Agendamento_quadraId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT "Agendamento_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES public."Quadra"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3842 (class 2606 OID 622597)
-- Name: Agendamento Agendamento_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT "Agendamento_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3843 (class 2606 OID 90411)
-- Name: Agendamento Agendamento_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT "Agendamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3924 (class 2606 OID 622640)
-- Name: AtletaCompeticao AtletaCompeticao_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaCompeticao"
    ADD CONSTRAINT "AtletaCompeticao_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3925 (class 2606 OID 622645)
-- Name: AtletaCompeticao AtletaCompeticao_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaCompeticao"
    ADD CONSTRAINT "AtletaCompeticao_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3832 (class 2606 OID 49327)
-- Name: Atleta Atleta_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Atleta"
    ADD CONSTRAINT "Atleta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3850 (class 2606 OID 622604)
-- Name: CardCliente CardCliente_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3851 (class 2606 OID 213012)
-- Name: CardCliente CardCliente_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id);


--
-- TOC entry 3852 (class 2606 OID 213017)
-- Name: CardCliente CardCliente_fechadoBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_fechadoBy_fkey" FOREIGN KEY ("fechadoBy") REFERENCES public."User"(id);


--
-- TOC entry 3853 (class 2606 OID 213007)
-- Name: CardCliente CardCliente_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3854 (class 2606 OID 622610)
-- Name: CardCliente CardCliente_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3855 (class 2606 OID 221184)
-- Name: CardCliente CardCliente_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CardCliente"
    ADD CONSTRAINT "CardCliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3869 (class 2606 OID 213150)
-- Name: CategoriaSaida CategoriaSaida_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CategoriaSaida"
    ADD CONSTRAINT "CategoriaSaida_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3870 (class 2606 OID 213170)
-- Name: CentroCusto CentroCusto_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CentroCusto"
    ADD CONSTRAINT "CentroCusto_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3920 (class 2606 OID 622616)
-- Name: Competicao Competicao_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Competicao"
    ADD CONSTRAINT "Competicao_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3921 (class 2606 OID 622621)
-- Name: Competicao Competicao_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Competicao"
    ADD CONSTRAINT "Competicao_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3871 (class 2606 OID 270351)
-- Name: EntradaCaixa EntradaCaixa_aberturaCaixaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EntradaCaixa"
    ADD CONSTRAINT "EntradaCaixa_aberturaCaixaId_fkey" FOREIGN KEY ("aberturaCaixaId") REFERENCES public."AberturaCaixa"(id) ON DELETE RESTRICT;


--
-- TOC entry 3872 (class 2606 OID 622652)
-- Name: EntradaCaixa EntradaCaixa_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EntradaCaixa"
    ADD CONSTRAINT "EntradaCaixa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3873 (class 2606 OID 213197)
-- Name: EntradaCaixa EntradaCaixa_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EntradaCaixa"
    ADD CONSTRAINT "EntradaCaixa_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id);


--
-- TOC entry 3874 (class 2606 OID 213192)
-- Name: EntradaCaixa EntradaCaixa_formaPagamentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EntradaCaixa"
    ADD CONSTRAINT "EntradaCaixa_formaPagamentoId_fkey" FOREIGN KEY ("formaPagamentoId") REFERENCES public."FormaPagamento"(id);


--
-- TOC entry 3875 (class 2606 OID 213187)
-- Name: EntradaCaixa EntradaCaixa_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EntradaCaixa"
    ADD CONSTRAINT "EntradaCaixa_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3876 (class 2606 OID 622658)
-- Name: EntradaCaixa EntradaCaixa_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EntradaCaixa"
    ADD CONSTRAINT "EntradaCaixa_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3861 (class 2606 OID 213084)
-- Name: FormaPagamento FormaPagamento_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."FormaPagamento"
    ADD CONSTRAINT "FormaPagamento_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3868 (class 2606 OID 213130)
-- Name: Fornecedor Fornecedor_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Fornecedor"
    ADD CONSTRAINT "Fornecedor_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3857 (class 2606 OID 213058)
-- Name: ItemCard ItemCard_cardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ItemCard"
    ADD CONSTRAINT "ItemCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES public."CardCliente"(id) ON DELETE CASCADE;


--
-- TOC entry 3858 (class 2606 OID 630784)
-- Name: ItemCard ItemCard_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ItemCard"
    ADD CONSTRAINT "ItemCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3859 (class 2606 OID 213063)
-- Name: ItemCard ItemCard_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ItemCard"
    ADD CONSTRAINT "ItemCard_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id);


--
-- TOC entry 3860 (class 2606 OID 630790)
-- Name: ItemCard ItemCard_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ItemCard"
    ADD CONSTRAINT "ItemCard_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3929 (class 2606 OID 622628)
-- Name: JogoCompeticao JogoCompeticao_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."JogoCompeticao"
    ADD CONSTRAINT "JogoCompeticao_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3930 (class 2606 OID 622633)
-- Name: JogoCompeticao JogoCompeticao_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."JogoCompeticao"
    ADD CONSTRAINT "JogoCompeticao_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3896 (class 2606 OID 393231)
-- Name: NotificacaoAgendamento NotificacaoAgendamento_agendamentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."NotificacaoAgendamento"
    ADD CONSTRAINT "NotificacaoAgendamento_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES public."Agendamento"(id) ON DELETE CASCADE;


--
-- TOC entry 3862 (class 2606 OID 278528)
-- Name: PagamentoCard PagamentoCard_aberturaCaixaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoCard"
    ADD CONSTRAINT "PagamentoCard_aberturaCaixaId_fkey" FOREIGN KEY ("aberturaCaixaId") REFERENCES public."AberturaCaixa"(id) ON DELETE SET NULL;


--
-- TOC entry 3863 (class 2606 OID 213100)
-- Name: PagamentoCard PagamentoCard_cardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoCard"
    ADD CONSTRAINT "PagamentoCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES public."CardCliente"(id) ON DELETE CASCADE;


--
-- TOC entry 3864 (class 2606 OID 622676)
-- Name: PagamentoCard PagamentoCard_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoCard"
    ADD CONSTRAINT "PagamentoCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3865 (class 2606 OID 213110)
-- Name: PagamentoCard PagamentoCard_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoCard"
    ADD CONSTRAINT "PagamentoCard_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id);


--
-- TOC entry 3866 (class 2606 OID 213105)
-- Name: PagamentoCard PagamentoCard_formaPagamentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoCard"
    ADD CONSTRAINT "PagamentoCard_formaPagamentoId_fkey" FOREIGN KEY ("formaPagamentoId") REFERENCES public."FormaPagamento"(id);


--
-- TOC entry 3867 (class 2606 OID 622682)
-- Name: PagamentoCard PagamentoCard_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoCard"
    ADD CONSTRAINT "PagamentoCard_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3904 (class 2606 OID 434190)
-- Name: PagamentoInfinitePay PagamentoInfinitePay_cardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoInfinitePay"
    ADD CONSTRAINT "PagamentoInfinitePay_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES public."CardCliente"(id) ON DELETE CASCADE;


--
-- TOC entry 3905 (class 2606 OID 434200)
-- Name: PagamentoInfinitePay PagamentoInfinitePay_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoInfinitePay"
    ADD CONSTRAINT "PagamentoInfinitePay_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3906 (class 2606 OID 434195)
-- Name: PagamentoInfinitePay PagamentoInfinitePay_pagamentoCardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoInfinitePay"
    ADD CONSTRAINT "PagamentoInfinitePay_pagamentoCardId_fkey" FOREIGN KEY ("pagamentoCardId") REFERENCES public."PagamentoCard"(id) ON DELETE SET NULL;


--
-- TOC entry 3887 (class 2606 OID 237584)
-- Name: PagamentoItem PagamentoItem_itemCardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoItem"
    ADD CONSTRAINT "PagamentoItem_itemCardId_fkey" FOREIGN KEY ("itemCardId") REFERENCES public."ItemCard"(id) ON DELETE CASCADE;


--
-- TOC entry 3888 (class 2606 OID 237579)
-- Name: PagamentoItem PagamentoItem_pagamentoCardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PagamentoItem"
    ADD CONSTRAINT "PagamentoItem_pagamentoCardId_fkey" FOREIGN KEY ("pagamentoCardId") REFERENCES public."PagamentoCard"(id) ON DELETE CASCADE;


--
-- TOC entry 3833 (class 2606 OID 41107)
-- Name: Partida Partida_atleta1Id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partida"
    ADD CONSTRAINT "Partida_atleta1Id_fkey" FOREIGN KEY ("atleta1Id") REFERENCES public."Atleta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3834 (class 2606 OID 41112)
-- Name: Partida Partida_atleta2Id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partida"
    ADD CONSTRAINT "Partida_atleta2Id_fkey" FOREIGN KEY ("atleta2Id") REFERENCES public."Atleta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3835 (class 2606 OID 41124)
-- Name: Partida Partida_atleta3Id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partida"
    ADD CONSTRAINT "Partida_atleta3Id_fkey" FOREIGN KEY ("atleta3Id") REFERENCES public."Atleta"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3836 (class 2606 OID 41129)
-- Name: Partida Partida_atleta4Id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partida"
    ADD CONSTRAINT "Partida_atleta4Id_fkey" FOREIGN KEY ("atleta4Id") REFERENCES public."Atleta"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3837 (class 2606 OID 41134)
-- Name: Partida Partida_torneioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partida"
    ADD CONSTRAINT "Partida_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES public."Torneio"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3856 (class 2606 OID 213040)
-- Name: Produto Produto_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3838 (class 2606 OID 90401)
-- Name: Quadra Quadra_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Quadra"
    ADD CONSTRAINT "Quadra_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3877 (class 2606 OID 270356)
-- Name: SaidaCaixa SaidaCaixa_aberturaCaixaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_aberturaCaixaId_fkey" FOREIGN KEY ("aberturaCaixaId") REFERENCES public."AberturaCaixa"(id) ON DELETE RESTRICT;


--
-- TOC entry 3878 (class 2606 OID 213225)
-- Name: SaidaCaixa SaidaCaixa_categoriaSaidaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_categoriaSaidaId_fkey" FOREIGN KEY ("categoriaSaidaId") REFERENCES public."CategoriaSaida"(id);


--
-- TOC entry 3879 (class 2606 OID 213230)
-- Name: SaidaCaixa SaidaCaixa_centroCustoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id);


--
-- TOC entry 3880 (class 2606 OID 622664)
-- Name: SaidaCaixa SaidaCaixa_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3881 (class 2606 OID 213240)
-- Name: SaidaCaixa SaidaCaixa_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id);


--
-- TOC entry 3882 (class 2606 OID 213235)
-- Name: SaidaCaixa SaidaCaixa_formaPagamentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_formaPagamentoId_fkey" FOREIGN KEY ("formaPagamentoId") REFERENCES public."FormaPagamento"(id);


--
-- TOC entry 3883 (class 2606 OID 213220)
-- Name: SaidaCaixa SaidaCaixa_fornecedorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Fornecedor"(id);


--
-- TOC entry 3884 (class 2606 OID 213215)
-- Name: SaidaCaixa SaidaCaixa_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3885 (class 2606 OID 253952)
-- Name: SaidaCaixa SaidaCaixa_tipoDespesaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_tipoDespesaId_fkey" FOREIGN KEY ("tipoDespesaId") REFERENCES public."TipoDespesa"(id);


--
-- TOC entry 3886 (class 2606 OID 622670)
-- Name: SaidaCaixa SaidaCaixa_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."SaidaCaixa"
    ADD CONSTRAINT "SaidaCaixa_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3846 (class 2606 OID 98630)
-- Name: TabelaPreco TabelaPreco_quadraId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."TabelaPreco"
    ADD CONSTRAINT "TabelaPreco_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES public."Quadra"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3889 (class 2606 OID 245772)
-- Name: TipoDespesa TipoDespesa_pointId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."TipoDespesa"
    ADD CONSTRAINT "TipoDespesa_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES public."Point"(id);


--
-- TOC entry 3830 (class 2606 OID 614401)
-- Name: User User_gestorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES public."User"(id) ON DELETE SET NULL;


--
-- TOC entry 3831 (class 2606 OID 106843)
-- Name: User User_pointIdGestor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pointIdGestor_fkey" FOREIGN KEY ("pointIdGestor") REFERENCES public."Point"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3933 (class 2606 OID 565260)
-- Name: AgendamentoParticipante fk_agendamento; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoParticipante"
    ADD CONSTRAINT fk_agendamento FOREIGN KEY ("agendamentoId") REFERENCES public."Agendamento"(id) ON DELETE CASCADE;


--
-- TOC entry 3844 (class 2606 OID 532480)
-- Name: Agendamento fk_agendamento_competicao; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT fk_agendamento_competicao FOREIGN KEY ("competicaoId") REFERENCES public."Competicao"(id) ON DELETE CASCADE;


--
-- TOC entry 3845 (class 2606 OID 475137)
-- Name: Agendamento fk_agendamento_professor; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Agendamento"
    ADD CONSTRAINT fk_agendamento_professor FOREIGN KEY ("professorId") REFERENCES public."Professor"(id) ON DELETE SET NULL;


--
-- TOC entry 3911 (class 2606 OID 450679)
-- Name: AlunoAula fk_aluno_aula_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoAula"
    ADD CONSTRAINT fk_aluno_aula_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3912 (class 2606 OID 450674)
-- Name: AlunoAula fk_aluno_aula_aula; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoAula"
    ADD CONSTRAINT fk_aluno_aula_aula FOREIGN KEY ("aulaId") REFERENCES public."Aula"(id) ON DELETE CASCADE;


--
-- TOC entry 3913 (class 2606 OID 450707)
-- Name: AlunoProfessor fk_aluno_professor_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoProfessor"
    ADD CONSTRAINT fk_aluno_professor_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3914 (class 2606 OID 450702)
-- Name: AlunoProfessor fk_aluno_professor_professor; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AlunoProfessor"
    ADD CONSTRAINT fk_aluno_professor_professor FOREIGN KEY ("professorId") REFERENCES public."Professor"(id) ON DELETE CASCADE;


--
-- TOC entry 3848 (class 2606 OID 163851)
-- Name: AtletaPoint fk_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaPoint"
    ADD CONSTRAINT fk_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3934 (class 2606 OID 565265)
-- Name: AgendamentoParticipante fk_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AgendamentoParticipante"
    ADD CONSTRAINT fk_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3926 (class 2606 OID 483369)
-- Name: AtletaCompeticao fk_atleta_competicao_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaCompeticao"
    ADD CONSTRAINT fk_atleta_competicao_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3927 (class 2606 OID 483364)
-- Name: AtletaCompeticao fk_atleta_competicao_competicao; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaCompeticao"
    ADD CONSTRAINT fk_atleta_competicao_competicao FOREIGN KEY ("competicaoId") REFERENCES public."Competicao"(id) ON DELETE CASCADE;


--
-- TOC entry 3928 (class 2606 OID 483374)
-- Name: AtletaCompeticao fk_atleta_competicao_parceiro; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaCompeticao"
    ADD CONSTRAINT fk_atleta_competicao_parceiro FOREIGN KEY ("parceiroAtletaId") REFERENCES public."Atleta"(id) ON DELETE SET NULL;


--
-- TOC entry 3909 (class 2606 OID 450647)
-- Name: Aula fk_aula_agendamento; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Aula"
    ADD CONSTRAINT fk_aula_agendamento FOREIGN KEY ("agendamentoId") REFERENCES public."Agendamento"(id) ON DELETE CASCADE;


--
-- TOC entry 3910 (class 2606 OID 450642)
-- Name: Aula fk_aula_professor; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Aula"
    ADD CONSTRAINT fk_aula_professor FOREIGN KEY ("professorId") REFERENCES public."Professor"(id) ON DELETE CASCADE;


--
-- TOC entry 3915 (class 2606 OID 450739)
-- Name: AvaliacaoAluno fk_avaliacao_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AvaliacaoAluno"
    ADD CONSTRAINT fk_avaliacao_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3916 (class 2606 OID 450729)
-- Name: AvaliacaoAluno fk_avaliacao_aula; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AvaliacaoAluno"
    ADD CONSTRAINT fk_avaliacao_aula FOREIGN KEY ("aulaId") REFERENCES public."Aula"(id) ON DELETE CASCADE;


--
-- TOC entry 3917 (class 2606 OID 450734)
-- Name: AvaliacaoAluno fk_avaliacao_professor; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AvaliacaoAluno"
    ADD CONSTRAINT fk_avaliacao_professor FOREIGN KEY ("professorId") REFERENCES public."Professor"(id) ON DELETE CASCADE;


--
-- TOC entry 3847 (class 2606 OID 139275)
-- Name: BloqueioAgenda fk_bloqueio_point; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."BloqueioAgenda"
    ADD CONSTRAINT fk_bloqueio_point FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3922 (class 2606 OID 483342)
-- Name: Competicao fk_competicao_point; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Competicao"
    ADD CONSTRAINT fk_competicao_point FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3923 (class 2606 OID 483347)
-- Name: Competicao fk_competicao_quadra; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Competicao"
    ADD CONSTRAINT fk_competicao_quadra FOREIGN KEY ("quadraId") REFERENCES public."Quadra"(id) ON DELETE SET NULL;


--
-- TOC entry 3931 (class 2606 OID 491537)
-- Name: JogoCompeticao fk_jogo_competicao_competicao; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."JogoCompeticao"
    ADD CONSTRAINT fk_jogo_competicao_competicao FOREIGN KEY ("competicaoId") REFERENCES public."Competicao"(id) ON DELETE CASCADE;


--
-- TOC entry 3932 (class 2606 OID 491542)
-- Name: JogoCompeticao fk_jogo_competicao_quadra; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."JogoCompeticao"
    ADD CONSTRAINT fk_jogo_competicao_quadra FOREIGN KEY ("quadraId") REFERENCES public."Quadra"(id) ON DELETE SET NULL;


--
-- TOC entry 3898 (class 2606 OID 409631)
-- Name: PanelinhaAtleta fk_panelinha_atleta_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PanelinhaAtleta"
    ADD CONSTRAINT fk_panelinha_atleta_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3897 (class 2606 OID 409610)
-- Name: Panelinha fk_panelinha_atleta_criador; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Panelinha"
    ADD CONSTRAINT fk_panelinha_atleta_criador FOREIGN KEY ("atletaIdCriador") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3899 (class 2606 OID 409626)
-- Name: PanelinhaAtleta fk_panelinha_atleta_panelinha; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PanelinhaAtleta"
    ADD CONSTRAINT fk_panelinha_atleta_panelinha FOREIGN KEY ("panelinhaId") REFERENCES public."Panelinha"(id) ON DELETE CASCADE;


--
-- TOC entry 3900 (class 2606 OID 426000)
-- Name: PartidaPanelinha fk_partida_panelinha_panelinha; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PartidaPanelinha"
    ADD CONSTRAINT fk_partida_panelinha_panelinha FOREIGN KEY ("panelinhaId") REFERENCES public."Panelinha"(id) ON DELETE CASCADE;


--
-- TOC entry 3901 (class 2606 OID 425995)
-- Name: PartidaPanelinha fk_partida_panelinha_partida; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PartidaPanelinha"
    ADD CONSTRAINT fk_partida_panelinha_partida FOREIGN KEY ("partidaId") REFERENCES public."Partida"(id) ON DELETE CASCADE;


--
-- TOC entry 3849 (class 2606 OID 163856)
-- Name: AtletaPoint fk_point; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AtletaPoint"
    ADD CONSTRAINT fk_point FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3918 (class 2606 OID 466965)
-- Name: ProfessorPoint fk_professor_point_point; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ProfessorPoint"
    ADD CONSTRAINT fk_professor_point_point FOREIGN KEY ("pointId") REFERENCES public."Point"(id) ON DELETE CASCADE;


--
-- TOC entry 3907 (class 2606 OID 466944)
-- Name: Professor fk_professor_point_principal; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Professor"
    ADD CONSTRAINT fk_professor_point_principal FOREIGN KEY ("pointIdPrincipal") REFERENCES public."Point"(id) ON DELETE SET NULL;


--
-- TOC entry 3919 (class 2606 OID 466960)
-- Name: ProfessorPoint fk_professor_point_professor; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ProfessorPoint"
    ADD CONSTRAINT fk_professor_point_professor FOREIGN KEY ("professorId") REFERENCES public."Professor"(id) ON DELETE CASCADE;


--
-- TOC entry 3908 (class 2606 OID 450619)
-- Name: Professor fk_professor_user; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Professor"
    ADD CONSTRAINT fk_professor_user FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- TOC entry 3902 (class 2606 OID 426031)
-- Name: RankingPanelinha fk_ranking_panelinha_atleta; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."RankingPanelinha"
    ADD CONSTRAINT fk_ranking_panelinha_atleta FOREIGN KEY ("atletaId") REFERENCES public."Atleta"(id) ON DELETE CASCADE;


--
-- TOC entry 3903 (class 2606 OID 426026)
-- Name: RankingPanelinha fk_ranking_panelinha_panelinha; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."RankingPanelinha"
    ADD CONSTRAINT fk_ranking_panelinha_panelinha FOREIGN KEY ("panelinhaId") REFERENCES public."Panelinha"(id) ON DELETE CASCADE;


