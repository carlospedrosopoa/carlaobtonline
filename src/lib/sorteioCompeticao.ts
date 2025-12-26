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

