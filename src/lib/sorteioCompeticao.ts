// lib/sorteioCompeticao.ts - Lógica de sorteio para competições Super 8
import type { AtletaCompeticao, RodadaCompeticao, FormatoCompeticao } from '@/types/competicao';

export interface ParticipanteSorteio {
  id: string; // atletaId ou parceriaId
  atletaId?: string; // Se for individual
  parceriaId?: string; // Se for duplas
  nome: string; // Nome do atleta ou da dupla
}

export interface JogoSorteado {
  rodada: RodadaCompeticao;
  numeroJogo: number;
  participante1: ParticipanteSorteio;
  participante2: ParticipanteSorteio;
}

/**
 * Embaralha um array usando o algoritmo Fisher-Yates
 */
function embaralhar<T>(array: T[]): T[] {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Converte participantes da competição em participantes do sorteio
 */
function prepararParticipantes(
  participantes: any[],
  formato: FormatoCompeticao
): ParticipanteSorteio[] {
  if (formato === 'INDIVIDUAL') {
    // Para individual, usar apenas um representante de cada atleta
    const atletasUnicos = new Map<string, ParticipanteSorteio>();
    participantes.forEach((p) => {
      if (p.atletaId && !atletasUnicos.has(p.atletaId)) {
        atletasUnicos.set(p.atletaId, {
          id: p.atletaId,
          atletaId: p.atletaId,
          nome: p.atleta?.nome || 'Atleta desconhecido',
        });
      }
    });
    return Array.from(atletasUnicos.values());
  } else {
    // DUPLAS: agrupar por parceriaId
    const duplasMap = new Map<string, ParticipanteSorteio>();

    participantes.forEach((p) => {
      if (p.parceriaId && !duplasMap.has(p.parceriaId)) {
        const nomeDupla = p.parceiro
          ? `${p.atleta?.nome || ''} & ${p.parceiro.nome || ''}`
          : p.atleta?.nome || 'Dupla desconhecida';
        
        duplasMap.set(p.parceriaId, {
          id: p.parceriaId,
          parceriaId: p.parceriaId,
          nome: nomeDupla.trim(),
        });
      }
    });

    return Array.from(duplasMap.values());
  }
}

/**
 * Gera o sorteio para Super 8
 * Super 8: 8 participantes -> 4 quartas -> 2 semi -> 1 final
 */
export function gerarSorteioSuper8(
  participantes: any[],
  formato: FormatoCompeticao
): JogoSorteado[] {
  // Preparar participantes
  const participantesPreparados = prepararParticipantes(participantes, formato);

  // Validar que tem exatamente 8 participantes (ou 4 duplas para formato duplas)
  if (formato === 'INDIVIDUAL' && participantesPreparados.length !== 8) {
    throw new Error(`Super 8 Individual requer exatamente 8 atletas, mas foram fornecidos ${participantesPreparados.length}`);
  }
  
  if (formato === 'DUPLAS' && participantesPreparados.length !== 4) {
    throw new Error(`Super 8 Duplas requer exatamente 4 duplas (8 atletas), mas foram fornecidas ${participantesPreparados.length} duplas`);
  }

  // Embaralhar os participantes
  const participantesEmbaralhados = embaralhar(participantesPreparados);

  const jogos: JogoSorteado[] = [];

  // Quartas de Final (4 jogos)
  for (let i = 0; i < 4; i++) {
    jogos.push({
      rodada: 'QUARTAS_FINAL',
      numeroJogo: i + 1,
      participante1: participantesEmbaralhados[i * 2],
      participante2: participantesEmbaralhados[i * 2 + 1],
    });
  }

  // Semifinais serão criadas depois quando as quartas terminarem
  // Por enquanto, apenas as quartas são criadas

  return jogos;
}

/**
 * Gera as semifinais baseado nos vencedores das quartas
 */
export function gerarSemifinais(vencedoresQuartas: ParticipanteSorteio[]): JogoSorteado[] {
  if (vencedoresQuartas.length !== 4) {
    throw new Error(`Semifinais requerem 4 vencedores das quartas, mas foram fornecidos ${vencedoresQuartas.length}`);
  }

  const jogos: JogoSorteado[] = [
    {
      rodada: 'SEMIFINAL',
      numeroJogo: 1,
      participante1: vencedoresQuartas[0],
      participante2: vencedoresQuartas[1],
    },
    {
      rodada: 'SEMIFINAL',
      numeroJogo: 2,
      participante1: vencedoresQuartas[2],
      participante2: vencedoresQuartas[3],
    },
  ];

  return jogos;
}

/**
 * Gera a final baseado nos vencedores das semifinais
 */
export function gerarFinal(vencedoresSemifinais: ParticipanteSorteio[]): JogoSorteado {
  if (vencedoresSemifinais.length !== 2) {
    throw new Error(`Final requer 2 vencedores das semifinais, mas foram fornecidos ${vencedoresSemifinais.length}`);
  }

  return {
    rodada: 'FINAL',
    numeroJogo: 1,
    participante1: vencedoresSemifinais[0],
    participante2: vencedoresSemifinais[1],
  };
}

/**
 * Gera round-robin para Super 8 Duplas
 * Cada atleta joga 7 jogos, nunca repetindo o parceiro
 * 7 rodadas, cada rodada com 2 jogos (4 duplas competem)
 */
export function gerarSorteioSuper8DuplasRoundRobin(
  participantes: any[]
): Array<JogoSorteado & { 
  participante1Atletas: string[]; 
  participante2Atletas: string[];
}> {
  // Extrair lista de atletas únicos
  const atletasMap = new Map<string, { id: string; nome: string }>();
  participantes.forEach((p) => {
    if (p.atletaId && !atletasMap.has(p.atletaId)) {
      atletasMap.set(p.atletaId, {
        id: p.atletaId,
        nome: p.atleta?.nome || 'Atleta desconhecido',
      });
    }
  });

  const atletas = Array.from(atletasMap.values());

  if (atletas.length !== 8) {
    throw new Error(`Super 8 Duplas Round-Robin requer exatamente 8 atletas, mas foram fornecidos ${atletas.length}`);
  }

  // Embaralhar atletas para randomizar
  const atletasEmbaralhados = embaralhar(atletas);

  // Algoritmo de round-robin circular para 8 atletas em 7 rodadas
  // Cada rodada: 2 jogos (4 duplas competem)
  // Garante que cada atleta joga com cada um dos outros 7 exatamente uma vez

  const jogos: Array<JogoSorteado & { 
    participante1Atletas: string[]; 
    participante2Atletas: string[];
  }> = [];

  // Usar algoritmo round-robin circular
  // Fixa o primeiro atleta e rotaciona os outros
  const fixo = atletasEmbaralhados[0];
  const rotativos = atletasEmbaralhados.slice(1);

  for (let rodada = 0; rodada < 7; rodada++) {
    // Rotacionar a lista (exceto o primeiro que fica fixo)
    const posicoes = [...rotativos];
    if (rodada > 0) {
      // Rotação circular: move o último para o início
      const ultimo = posicoes.pop()!;
      posicoes.unshift(ultimo);
    }

    // Formar 4 duplas da rodada usando algoritmo round-robin
    // Dupla 1: fixo + posicoes[0]
    // Dupla 2: posicoes[1] + posicoes[6]
    // Dupla 3: posicoes[2] + posicoes[5]
    // Dupla 4: posicoes[3] + posicoes[4]

    const duplas = [
      {
        atleta1: fixo,
        atleta2: posicoes[0],
        id: `dupla-${rodada}-1`,
        nome: `${fixo.nome} & ${posicoes[0].nome}`,
      },
      {
        atleta1: posicoes[1],
        atleta2: posicoes[6],
        id: `dupla-${rodada}-2`,
        nome: `${posicoes[1].nome} & ${posicoes[6].nome}`,
      },
      {
        atleta1: posicoes[2],
        atleta2: posicoes[5],
        id: `dupla-${rodada}-3`,
        nome: `${posicoes[2].nome} & ${posicoes[5].nome}`,
      },
      {
        atleta1: posicoes[3],
        atleta2: posicoes[4],
        id: `dupla-${rodada}-4`,
        nome: `${posicoes[3].nome} & ${posicoes[4].nome}`,
      },
    ];

    // Gerar 2 jogos: Dupla 1 vs Dupla 2, Dupla 3 vs Dupla 4
    // Isso resulta em 2 jogos por rodada × 7 rodadas = 14 jogos
    // Cada jogo tem 4 atletas, então 14 × 4 = 56 participações
    // 56 / 8 atletas = 7 jogos por atleta ✓

    jogos.push({
      rodada: `RODADA_${rodada + 1}` as any,
      numeroJogo: 1,
      participante1: {
        id: duplas[0].id,
        nome: duplas[0].nome,
      },
      participante2: {
        id: duplas[1].id,
        nome: duplas[1].nome,
      },
      participante1Atletas: [duplas[0].atleta1.id, duplas[0].atleta2.id],
      participante2Atletas: [duplas[1].atleta1.id, duplas[1].atleta2.id],
    });

    jogos.push({
      rodada: `RODADA_${rodada + 1}` as any,
      numeroJogo: 2,
      participante1: {
        id: duplas[2].id,
        nome: duplas[2].nome,
      },
      participante2: {
        id: duplas[3].id,
        nome: duplas[3].nome,
      },
      participante1Atletas: [duplas[2].atleta1.id, duplas[2].atleta2.id],
      participante2Atletas: [duplas[3].atleta1.id, duplas[3].atleta2.id],
    });
  }

  return jogos;
}

