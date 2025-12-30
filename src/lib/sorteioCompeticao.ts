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
 * Gera round-robin para Super 8 Duplas (ALGORITMO DETERMINÍSTICO)
 * Cada atleta joga 7 jogos, nunca repetindo o parceiro
 * 7 rodadas, cada rodada com 2 jogos (4 duplas competem)
 * 
 * Algoritmo determinístico baseado em round-robin circular:
 * - Garante que cada atleta joga 7 jogos (um por rodada)
 * - Garante que cada atleta joga COM 7 parceiros diferentes (um por rodada, sem repetir)
 * - Garante que cada atleta enfrenta CONTRA todos os outros 7 pelo menos uma vez (como oponente)
 * 
 * NOTA: É matematicamente impossível que cada atleta jogue COM todos os outros 7 como parceiro
 * em apenas 7 rodadas (seriam necessárias 14 rodadas). O algoritmo garante o requisito principal:
 * que todos os atletas se enfrentem pelo menos uma vez.
 * 
 * O algoritmo usa uma matriz de rotação fixa que garante matematicamente todos os enfrentamentos.
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

  // Embaralhar atletas para randomizar a ordem inicial
  // A matriz determinística será aplicada após o embaralhamento
  const atletasEmbaralhados = embaralhar(atletas);

  const jogos: Array<JogoSorteado & { 
    participante1Atletas: string[]; 
    participante2Atletas: string[];
  }> = [];

  // Rastrear parceiros e enfrentamentos
  const parceiros = new Map<string, Set<string>>(); // Quem jogou COM cada atleta
  const enfrentamentos = new Map<string, Set<string>>(); // Quem enfrentou CONTRA cada atleta
  atletas.forEach(a => {
    parceiros.set(a.id, new Set());
    enfrentamentos.set(a.id, new Set());
  });

  // MATRIZ DETERMINÍSTICA: Round-robin para garantir que cada atleta jogue com cada um dos outros 7 exatamente uma vez
  // Matriz baseada na escala fornecida pelo usuário
  // Os índices são baseados em 0 (0-7), mas a matriz original usa índices baseados em 1 (1-8)
  // Rodada 1: (1,2) vs (3,4) e (5,6) vs (7,8)  -> índices: (0,1) vs (2,3) e (4,5) vs (6,7)
  // Rodada 2: (1,3) vs (5,7) e (2,4) vs (6,8)  -> índices: (0,2) vs (4,6) e (1,3) vs (5,7)
  // Rodada 3: (1,4) vs (6,7) e (2,3) vs (5,8)  -> índices: (0,3) vs (5,6) e (1,2) vs (4,7)
  // Rodada 4: (1,5) vs (2,6) e (3,7) vs (4,8)  -> índices: (0,4) vs (1,5) e (2,6) vs (3,7)
  // Rodada 5: (1,6) vs (3,8) e (2,5) vs (4,7)  -> índices: (0,5) vs (2,7) e (1,4) vs (3,6)
  // Rodada 6: (1,7) vs (2,8) e (3,5) vs (4,6)  -> índices: (0,6) vs (1,7) e (2,4) vs (3,5)
  // Rodada 7: (1,8) vs (2,7) e (3,6) vs (4,5)  -> índices: (0,7) vs (1,6) e (2,5) vs (3,4)
  
  const matrizRodadas = [
    // Rodada 1: (0,1) vs (2,3) e (4,5) vs (6,7)
    { jogo1: { dupla1: [0, 1], dupla2: [2, 3] }, jogo2: { dupla1: [4, 5], dupla2: [6, 7] } },
    // Rodada 2: (0,2) vs (4,6) e (1,3) vs (5,7)
    { jogo1: { dupla1: [0, 2], dupla2: [4, 6] }, jogo2: { dupla1: [1, 3], dupla2: [5, 7] } },
    // Rodada 3: (0,3) vs (5,6) e (1,2) vs (4,7)
    { jogo1: { dupla1: [0, 3], dupla2: [5, 6] }, jogo2: { dupla1: [1, 2], dupla2: [4, 7] } },
    // Rodada 4: (0,4) vs (1,5) e (2,6) vs (3,7)
    { jogo1: { dupla1: [0, 4], dupla2: [1, 5] }, jogo2: { dupla1: [2, 6], dupla2: [3, 7] } },
    // Rodada 5: (0,5) vs (2,7) e (1,4) vs (3,6)
    { jogo1: { dupla1: [0, 5], dupla2: [2, 7] }, jogo2: { dupla1: [1, 4], dupla2: [3, 6] } },
    // Rodada 6: (0,6) vs (1,7) e (2,4) vs (3,5)
    { jogo1: { dupla1: [0, 6], dupla2: [1, 7] }, jogo2: { dupla1: [2, 4], dupla2: [3, 5] } },
    // Rodada 7: (0,7) vs (1,6) e (2,5) vs (3,4)
    { jogo1: { dupla1: [0, 7], dupla2: [1, 6] }, jogo2: { dupla1: [2, 5], dupla2: [3, 4] } },
  ];

  for (let rodada = 0; rodada < 7; rodada++) {
    const configRodada = matrizRodadas[rodada];
    
    // Jogo 1 da rodada
    const dupla1Jogo1 = [atletasEmbaralhados[configRodada.jogo1.dupla1[0]], atletasEmbaralhados[configRodada.jogo1.dupla1[1]]];
    const dupla2Jogo1 = [atletasEmbaralhados[configRodada.jogo1.dupla2[0]], atletasEmbaralhados[configRodada.jogo1.dupla2[1]]];
    
    // Jogo 2 da rodada
    const dupla1Jogo2 = [atletasEmbaralhados[configRodada.jogo2.dupla1[0]], atletasEmbaralhados[configRodada.jogo2.dupla1[1]]];
    const dupla2Jogo2 = [atletasEmbaralhados[configRodada.jogo2.dupla2[0]], atletasEmbaralhados[configRodada.jogo2.dupla2[1]]];
    
    // Formar duplas para validação
    const duplas = [
      { atleta1: dupla1Jogo1[0], atleta2: dupla1Jogo1[1] },
      { atleta1: dupla2Jogo1[0], atleta2: dupla2Jogo1[1] },
      { atleta1: dupla1Jogo2[0], atleta2: dupla1Jogo2[1] },
      { atleta1: dupla2Jogo2[0], atleta2: dupla2Jogo2[1] },
    ];
    
    // Validar que não há parceiros repetidos ANTES de registrar
    // Esta validação é crítica para garantir que cada atleta jogue com cada um dos outros 7 exatamente uma vez
    for (const dupla of duplas) {
      const parceiroAtual1 = parceiros.get(dupla.atleta1.id);
      const parceiroAtual2 = parceiros.get(dupla.atleta2.id);
      
      if (parceiroAtual1?.has(dupla.atleta2.id)) {
        const nomeAtleta1 = dupla.atleta1.nome;
        const nomeAtleta2 = dupla.atleta2.nome;
        console.error(`[SORTEIO] ERRO CRÍTICO na rodada ${rodada + 1}: ${nomeAtleta1} (${dupla.atleta1.id}) já jogou com ${nomeAtleta2} (${dupla.atleta2.id})`);
        console.error(`[SORTEIO] Parceiros atuais de ${nomeAtleta1}:`, Array.from(parceiroAtual1 || []).map(id => atletas.find(a => a.id === id)?.nome || id));
        throw new Error(`Erro na rodada ${rodada + 1}: ${nomeAtleta1} já jogou com ${nomeAtleta2}. Isso viola a regra de que cada atleta deve jogar com cada um dos outros 7 exatamente uma vez.`);
      }
      
      if (parceiroAtual2?.has(dupla.atleta1.id)) {
        const nomeAtleta1 = dupla.atleta1.nome;
        const nomeAtleta2 = dupla.atleta2.nome;
        console.error(`[SORTEIO] ERRO CRÍTICO na rodada ${rodada + 1}: ${nomeAtleta2} (${dupla.atleta2.id}) já jogou com ${nomeAtleta1} (${dupla.atleta1.id})`);
        console.error(`[SORTEIO] Parceiros atuais de ${nomeAtleta2}:`, Array.from(parceiroAtual2 || []).map(id => atletas.find(a => a.id === id)?.nome || id));
        throw new Error(`Erro na rodada ${rodada + 1}: ${nomeAtleta2} já jogou com ${nomeAtleta1}. Isso viola a regra de que cada atleta deve jogar com cada um dos outros 7 exatamente uma vez.`);
      }
    }

    // Registrar parceiros desta rodada
    duplas.forEach(dupla => {
      parceiros.get(dupla.atleta1.id)?.add(dupla.atleta2.id);
      parceiros.get(dupla.atleta2.id)?.add(dupla.atleta1.id);
    });

    // Validar que não há atletas duplicados nas duplas
    const todosIds = [
      duplas[0].atleta1.id, duplas[0].atleta2.id,
      duplas[1].atleta1.id, duplas[1].atleta2.id,
      duplas[2].atleta1.id, duplas[2].atleta2.id,
      duplas[3].atleta1.id, duplas[3].atleta2.id,
    ];
    const idsUnicos = new Set(todosIds);
    if (idsUnicos.size !== 8) {
      const duplicados = todosIds.filter((id, idx) => todosIds.indexOf(id) !== idx);
      throw new Error(`Erro na geração: atletas duplicados na rodada ${rodada + 1}: ${duplicados.join(', ')}`);
    }

    // Gerar 2 jogos: Dupla 1 vs Dupla 2, Dupla 3 vs Dupla 4
    const dupla1Ids = [duplas[0].atleta1.id, duplas[0].atleta2.id];
    const dupla2Ids = [duplas[1].atleta1.id, duplas[1].atleta2.id];
    const dupla3Ids = [duplas[2].atleta1.id, duplas[2].atleta2.id];
    const dupla4Ids = [duplas[3].atleta1.id, duplas[3].atleta2.id];
    
    // Registrar enfrentamentos do Jogo 1: Dupla 1 vs Dupla 2
    dupla1Ids.forEach(a1 => {
      dupla2Ids.forEach(a2 => {
        enfrentamentos.get(a1)?.add(a2);
        enfrentamentos.get(a2)?.add(a1);
      });
    });
    
    // Registrar enfrentamentos do Jogo 2: Dupla 3 vs Dupla 4
    dupla3Ids.forEach(a1 => {
      dupla4Ids.forEach(a2 => {
        enfrentamentos.get(a1)?.add(a2);
        enfrentamentos.get(a2)?.add(a1);
      });
    });

    jogos.push({
      rodada: `RODADA_${rodada + 1}` as any,
      numeroJogo: 1,
      participante1: {
        id: `dupla-${rodada}-1`,
        nome: `${duplas[0].atleta1.nome} & ${duplas[0].atleta2.nome}`,
      },
      participante2: {
        id: `dupla-${rodada}-2`,
        nome: `${duplas[1].atleta1.nome} & ${duplas[1].atleta2.nome}`,
      },
      participante1Atletas: dupla1Ids,
      participante2Atletas: dupla2Ids,
    });

    jogos.push({
      rodada: `RODADA_${rodada + 1}` as any,
      numeroJogo: 2,
      participante1: {
        id: `dupla-${rodada}-3`,
        nome: `${duplas[2].atleta1.nome} & ${duplas[2].atleta2.nome}`,
      },
      participante2: {
        id: `dupla-${rodada}-4`,
        nome: `${duplas[3].atleta1.nome} & ${duplas[3].atleta2.nome}`,
      },
      participante1Atletas: dupla3Ids,
      participante2Atletas: dupla4Ids,
    });
  }

  // VALIDAÇÃO FINAL CRÍTICA: Verificar se cada atleta jogou com cada um dos outros 7 exatamente uma vez
  console.log('[SORTEIO] Validando parceiros finais...');
  for (const atleta of atletas) {
    const parceirosAtleta = parceiros.get(atleta.id);
    const totalParceiros = parceirosAtleta ? parceirosAtleta.size : 0;
    const esperado = atletas.length - 1; // 7 parceiros (todos os outros 7)
    
    if (totalParceiros !== esperado) {
      const faltando = atletas
        .filter(a => a.id !== atleta.id && !parceirosAtleta?.has(a.id))
        .map(a => a.nome);
      const mensagem = `ERRO CRÍTICO: ${atleta.nome} jogou com apenas ${totalParceiros}/${esperado} parceiros diferentes. Faltando: ${faltando.join(', ')}`;
      console.error(`[SORTEIO] ${mensagem}`);
      throw new Error(mensagem);
    }
    
    // Verificar se há parceiros repetidos
    const jogosDoAtleta = jogos.filter(jogo => {
      const dupla1 = jogo.participante1Atletas || [];
      const dupla2 = jogo.participante2Atletas || [];
      return dupla1.includes(atleta.id) || dupla2.includes(atleta.id);
    });
    
    const parceirosEncontrados = new Map<string, number>();
    jogosDoAtleta.forEach(jogo => {
      const dupla1 = jogo.participante1Atletas || [];
      const dupla2 = jogo.participante2Atletas || [];
      const duplaDoAtleta = dupla1.includes(atleta.id) ? dupla1 : dupla2;
      const parceiro = duplaDoAtleta.find(a => a !== atleta.id);
      if (parceiro) {
        parceirosEncontrados.set(parceiro, (parceirosEncontrados.get(parceiro) || 0) + 1);
      }
    });
    
    for (const [parceiroId, count] of parceirosEncontrados.entries()) {
      if (count > 1) {
        const nomeParceiro = atletas.find(a => a.id === parceiroId)?.nome || parceiroId;
        const mensagem = `ERRO CRÍTICO: ${atleta.nome} jogou ${count} vezes com ${nomeParceiro}. Cada atleta deve jogar com cada um dos outros 7 exatamente uma vez.`;
        console.error(`[SORTEIO] ${mensagem}`);
        throw new Error(mensagem);
      }
    }
  }
  console.log('[SORTEIO] ✅ Validação de parceiros passou! Cada atleta jogou com cada um dos outros 7 exatamente uma vez.');

  // Validação final: verificar se cada atleta enfrente todos os outros pelo menos uma vez
  // (os enfrentamentos já foram registrados durante a geração)

  // Verificar se algum par de atletas não se enfrentou
  const paresFaltando: Array<[string, string]> = [];
  for (let i = 0; i < atletas.length; i++) {
    for (let j = i + 1; j < atletas.length; j++) {
      const a1 = atletas[i].id;
      const a2 = atletas[j].id;
      if (!enfrentamentos.get(a1)?.has(a2)) {
        paresFaltando.push([a1, a2]);
      }
    }
  }

  // Se houver pares faltando, NÃO ajustar os jogos para evitar criar parceiros repetidos
  // A regra principal é mais importante: cada atleta deve jogar com cada um dos outros 7 exatamente uma vez
  // Se alguns enfrentamentos faltarem, é aceitável, mas NUNCA podemos ter parceiros repetidos
  if (paresFaltando.length > 0) {
    console.warn(`[SORTEIO] ⚠️ Encontrados ${paresFaltando.length} pares de atletas que não se enfrentaram, mas NÃO vamos ajustar para evitar criar parceiros repetidos.`);
    console.warn(`[SORTEIO] A regra principal (cada atleta joga com cada um dos outros 7 exatamente uma vez) é mais importante que garantir todos os enfrentamentos.`);
    
    // NÃO fazer ajustes - isso violaria a regra de parceiros únicos
    // A matriz determinística já garante a maioria dos enfrentamentos
    // Código de ajuste removido para evitar criar parceiros repetidos
  } else {
    console.log(`[SORTEIO] ✅ Todos os pares de atletas já se enfrentam!`);
  }

  return jogos;
}
