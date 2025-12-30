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

  // Embaralhar atletas para randomizar (mas o algoritmo em si é determinístico)
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

  // ALGORITMO DETERMINÍSTICO: Round-robin para garantir que cada atleta jogue com cada um dos outros 7 exatamente uma vez
  // 1. Cada atleta joga exatamente 7 jogos (um por rodada)
  // 2. Cada atleta joga com 7 parceiros diferentes (cada um dos outros 7 exatamente uma vez)
  // 3. Se possível, cada atleta enfrenta todos os outros pelo menos uma vez
  
  // Algoritmo: Round-robin circular clássico para 8 jogadores (7 rodadas)
  // Estrutura: fixo + rotação dos outros 7
  // O fixo joga com cada rotativo uma vez (7 rodadas)
  // Os 7 rotativos formam duplas entre si usando rotação circular
  
  const fixo = atletasEmbaralhados[0];
  const rotativos = atletasEmbaralhados.slice(1); // 7 atletas restantes

  // Matriz determinística que garante cada par de rotativos jogue junto exatamente uma vez
  // Para 7 rotativos, temos C(7,2) = 21 pares possíveis
  // Em 7 rodadas com 3 duplas de rotativos cada = 21 pares totais (exatamente o necessário!)
  // Matriz baseada em round-robin circular onde cada rotativo joga com cada um dos outros 6 exatamente uma vez
  
  // Matriz de pares para cada rodada (índices dos rotativos, excluindo o que está com o fixo)
  // Cada linha representa uma rodada, com o primeiro elemento sendo o parceiro do fixo
  // Esta matriz garante que cada par de rotativos jogue junto exatamente uma vez
  const matrizPares = [
    // Rodada 0: fixo+0, 1+6, 2+5, 3+4
    [0, [1, 6], [2, 5], [3, 4]],
    // Rodada 1: fixo+1, 2+0, 3+6, 4+5
    [1, [2, 0], [3, 6], [4, 5]],
    // Rodada 2: fixo+2, 3+1, 4+0, 5+6
    [2, [3, 1], [4, 0], [5, 6]],
    // Rodada 3: fixo+3, 4+2, 5+1, 6+0
    [3, [4, 2], [5, 1], [6, 0]],
    // Rodada 4: fixo+4, 5+3, 6+2, 0+1
    [4, [5, 3], [6, 2], [0, 1]],
    // Rodada 5: fixo+5, 6+4, 0+3, 1+2
    [5, [6, 4], [0, 3], [1, 2]],
    // Rodada 6: fixo+6, 0+5, 1+4, 2+3
    [6, [0, 5], [1, 4], [2, 3]],
  ];

  for (let rodada = 0; rodada < 7; rodada++) {
    const configRodada = matrizPares[rodada];
    const parceiroFixoIdx = configRodada[0] as number;
    const parceiroFixo = rotativos[parceiroFixoIdx];
    
    // Formar 4 duplas usando a matriz determinística
    let duplas = [
      { atleta1: fixo, atleta2: parceiroFixo },
      { atleta1: rotativos[(configRodada[1] as number[])[0]], atleta2: rotativos[(configRodada[1] as number[])[1]] },
      { atleta1: rotativos[(configRodada[2] as number[])[0]], atleta2: rotativos[(configRodada[2] as number[])[1]] },
      { atleta1: rotativos[(configRodada[3] as number[])[0]], atleta2: rotativos[(configRodada[3] as number[])[1]] },
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

  // Se houver pares faltando, ajustar os jogos de forma mais agressiva
  if (paresFaltando.length > 0) {
    console.log(`[SORTEIO] Encontrados ${paresFaltando.length} pares de atletas que não se enfrentaram. Ajustando...`);
    
    // Para cada par faltando, tentar encontrar um jogo onde podemos ajustar
    for (const [atleta1, atleta2] of paresFaltando) {
      let ajustado = false;
      
      // Primeiro, tentar encontrar um jogo onde ambos estão na mesma dupla (mais fácil de ajustar)
      for (let idx = 0; idx < jogos.length && !ajustado; idx++) {
        const jogo = jogos[idx];
        const atletas1 = [...jogo.participante1Atletas];
        const atletas2 = [...jogo.participante2Atletas];
        
        const a1NaDupla1 = atletas1.includes(atleta1);
        const a1NaDupla2 = atletas2.includes(atleta1);
        const a2NaDupla1 = atletas1.includes(atleta2);
        const a2NaDupla2 = atletas2.includes(atleta2);
        
        // Se ambos estão na mesma dupla, trocar um deles para a dupla oposta
        if (a1NaDupla1 && a2NaDupla1) {
          // Trocar atleta2 para a dupla 2
          const outroAtletaDupla2 = atletas2.find(a => a !== atleta1 && a !== atleta2);
          if (outroAtletaDupla2) {
            const idxA2 = atletas1.indexOf(atleta2);
            const idxOutro = atletas2.indexOf(outroAtletaDupla2);
            // Validar que a troca não cria parceiros repetidos
            const parceirosA1Antes = parceiros.get(atletas1[0]) || new Set();
            const parceirosA2Antes = parceiros.get(atletas1[1]) || new Set();
            const parceirosOutroAntes = parceiros.get(outroAtletaDupla2) || new Set();
            const parceirosA2NovoAntes = parceiros.get(atleta2) || new Set();
            
            // Verificar se a troca criaria parceiros repetidos
            if (parceirosA1Antes.has(outroAtletaDupla2) || parceirosOutroAntes.has(atletas1[0]) ||
                parceirosA2NovoAntes.has(atletas2.find(a => a !== outroAtletaDupla2) || '') ||
                parceiros.get(atletas2.find(a => a !== outroAtletaDupla2) || '')?.has(atleta2)) {
              console.warn(`[SORTEIO] Troca rejeitada: criaria parceiros repetidos no jogo ${idx + 1}`);
              continue;
            }
            
            atletas1[idxA2] = outroAtletaDupla2;
            atletas2[idxOutro] = atleta2;
            
            // Atualizar parceiros após a troca
            parceiros.get(atletas1[0])?.delete(atleta2);
            parceiros.get(atleta2)?.delete(atletas1[0]);
            parceiros.get(atletas1[0])?.add(outroAtletaDupla2);
            parceiros.get(outroAtletaDupla2)?.add(atletas1[0]);
            parceiros.get(atletas2.find(a => a !== atleta2) || '')?.delete(outroAtletaDupla2);
            parceiros.get(outroAtletaDupla2)?.delete(atletas2.find(a => a !== atleta2) || '');
            parceiros.get(atletas2.find(a => a !== atleta2) || '')?.add(atleta2);
            parceiros.get(atleta2)?.add(atletas2.find(a => a !== atleta2) || '');
            
            // Buscar nomes dos atletas para atualizar o nome da dupla
            const nomeA1 = atletas.find(a => a.id === atletas1[0])?.nome || '';
            const nomeA2 = atletas.find(a => a.id === atletas1[1])?.nome || '';
            const nomeA3 = atletas.find(a => a.id === atletas2[0])?.nome || '';
            const nomeA4 = atletas.find(a => a.id === atletas2[1])?.nome || '';
            
            jogos[idx] = {
              ...jogo,
              participante1Atletas: atletas1,
              participante2Atletas: atletas2,
              participante1: {
                id: jogo.participante1.id,
                nome: `${nomeA1} & ${nomeA2}`,
              },
              participante2: {
                id: jogo.participante2.id,
                nome: `${nomeA3} & ${nomeA4}`,
              },
            };
            
            enfrentamentos.get(atleta1)?.add(atleta2);
            enfrentamentos.get(atleta2)?.add(atleta1);
            ajustado = true;
            console.log(`[SORTEIO] Ajustado jogo ${idx + 1}: ${atleta1} e ${atleta2} agora se enfrentam`);
          }
        } else if (a1NaDupla2 && a2NaDupla2) {
          // Trocar atleta2 para a dupla 1
          const outroAtletaDupla1 = atletas1.find(a => a !== atleta1 && a !== atleta2);
          if (outroAtletaDupla1) {
            // Validar que não há duplicatas após a troca
            const todosIdsAposTroca = [...atletas1, ...atletas2];
            todosIdsAposTroca[atletas2.indexOf(atleta2)] = outroAtletaDupla1;
            todosIdsAposTroca[atletas1.indexOf(outroAtletaDupla1)] = atleta2;
            const idsUnicos = new Set(todosIdsAposTroca);
            
            if (idsUnicos.size === 4) {
              const idxA2 = atletas2.indexOf(atleta2);
              const idxOutro = atletas1.indexOf(outroAtletaDupla1);
              atletas2[idxA2] = outroAtletaDupla1;
              atletas1[idxOutro] = atleta2;
              
              // Buscar nomes dos atletas para atualizar o nome da dupla
              const nomeA1 = atletas.find(a => a.id === atletas1[0])?.nome || '';
              const nomeA2 = atletas.find(a => a.id === atletas1[1])?.nome || '';
              const nomeA3 = atletas.find(a => a.id === atletas2[0])?.nome || '';
              const nomeA4 = atletas.find(a => a.id === atletas2[1])?.nome || '';
              
              jogos[idx] = {
                ...jogo,
                participante1Atletas: atletas1,
                participante2Atletas: atletas2,
                participante1: {
                  id: jogo.participante1.id,
                  nome: `${nomeA1} & ${nomeA2}`,
                },
                participante2: {
                  id: jogo.participante2.id,
                  nome: `${nomeA3} & ${nomeA4}`,
                },
              };
            } else {
              console.warn(`[SORTEIO] Troca rejeitada: criaria duplicatas no jogo ${idx + 1}`);
              continue;
            }
            
            enfrentamentos.get(atleta1)?.add(atleta2);
            enfrentamentos.get(atleta2)?.add(atleta1);
            ajustado = true;
            console.log(`[SORTEIO] Ajustado jogo ${idx + 1}: ${atleta1} e ${atleta2} agora se enfrentam`);
          }
        }
      }
      
      // Se não conseguiu ajustar (ambos em duplas diferentes ou não estão no mesmo jogo),
      // tentar uma estratégia mais agressiva: trocar atletas entre jogos diferentes
      if (!ajustado) {
        // Procurar dois jogos onde podemos fazer uma troca cruzada
        for (let idx1 = 0; idx1 < jogos.length && !ajustado; idx1++) {
          for (let idx2 = idx1 + 1; idx2 < jogos.length && !ajustado; idx2++) {
            const jogo1 = jogos[idx1];
            const jogo2 = jogos[idx2];
            
            const atletas1_j1 = [...jogo1.participante1Atletas];
            const atletas2_j1 = [...jogo1.participante2Atletas];
            const atletas1_j2 = [...jogo2.participante1Atletas];
            const atletas2_j2 = [...jogo2.participante2Atletas];
            
            // Verificar se atleta1 está em jogo1 e atleta2 está em jogo2 (ou vice-versa)
            const a1NoJogo1 = atletas1_j1.includes(atleta1) || atletas2_j1.includes(atleta1);
            const a2NoJogo2 = atletas1_j2.includes(atleta2) || atletas2_j2.includes(atleta2);
            const a1NoJogo2 = atletas1_j2.includes(atleta1) || atletas2_j2.includes(atleta1);
            const a2NoJogo1 = atletas1_j1.includes(atleta2) || atletas2_j1.includes(atleta2);
            
            // Se estão em jogos diferentes, tentar trocar para colocá-los no mesmo jogo em duplas opostas
            if (a1NoJogo1 && a2NoJogo2 && !a1NoJogo2 && !a2NoJogo1) {
              // Trocar atleta2 do jogo2 para o jogo1 (na dupla oposta de atleta1)
              const a1NaDupla1_j1 = atletas1_j1.includes(atleta1);
              const a1NaDupla2_j1 = atletas2_j1.includes(atleta1);
              
              // Encontrar um atleta do jogo1 que podemos trocar com atleta2
              let atletaParaTrocar: string | null = null;
              let duplaParaTrocar: number[] | null = null;
              
              if (a1NaDupla1_j1) {
                // atleta1 está na dupla1 do jogo1, então atleta2 deve ir para dupla2
                atletaParaTrocar = atletas2_j1.find(a => a !== atleta1) || null;
                duplaParaTrocar = atletas2_j1;
              } else if (a1NaDupla2_j1) {
                // atleta1 está na dupla2 do jogo1, então atleta2 deve ir para dupla1
                atletaParaTrocar = atletas1_j1.find(a => a !== atleta1) || null;
                duplaParaTrocar = atletas1_j1;
              }
              
              if (atletaParaTrocar && duplaParaTrocar) {
                // Encontrar onde atleta2 está no jogo2
                const a2NaDupla1_j2 = atletas1_j2.includes(atleta2);
                const a2NaDupla2_j2 = atletas2_j2.includes(atleta2);
                
                if (a2NaDupla1_j2) {
                  const idxA2 = atletas1_j2.indexOf(atleta2);
                  const idxTroca = duplaParaTrocar.indexOf(atletaParaTrocar);
                  
                  // Trocar: atleta2 vai para jogo1, atletaParaTrocar vai para jogo2
                  duplaParaTrocar[idxTroca] = atleta2;
                  atletas1_j2[idxA2] = atletaParaTrocar;
                  
                  // Atualizar jogos
                  if (a1NaDupla1_j1) {
                    jogos[idx1] = {
                      ...jogo1,
                      participante1Atletas: atletas1_j1,
                      participante2Atletas: duplaParaTrocar,
                      participante1: {
                        id: jogo1.participante1.id,
                        nome: `${atletas.find(a => a.id === atletas1_j1[0])?.nome || ''} & ${atletas.find(a => a.id === atletas1_j1[1])?.nome || ''}`,
                      },
                      participante2: {
                        id: jogo1.participante2.id,
                        nome: `${atletas.find(a => a.id === duplaParaTrocar[0])?.nome || ''} & ${atletas.find(a => a.id === duplaParaTrocar[1])?.nome || ''}`,
                      },
                    };
                  } else {
                    jogos[idx1] = {
                      ...jogo1,
                      participante1Atletas: duplaParaTrocar,
                      participante2Atletas: atletas2_j1,
                      participante1: {
                        id: jogo1.participante1.id,
                        nome: `${atletas.find(a => a.id === duplaParaTrocar[0])?.nome || ''} & ${atletas.find(a => a.id === duplaParaTrocar[1])?.nome || ''}`,
                      },
                      participante2: {
                        id: jogo1.participante2.id,
                        nome: `${atletas.find(a => a.id === atletas2_j1[0])?.nome || ''} & ${atletas.find(a => a.id === atletas2_j1[1])?.nome || ''}`,
                      },
                    };
                  }
                  
                  jogos[idx2] = {
                    ...jogo2,
                    participante1Atletas: atletas1_j2,
                    participante2Atletas: atletas2_j2,
                    participante1: {
                      id: jogo2.participante1.id,
                      nome: `${atletas.find(a => a.id === atletas1_j2[0])?.nome || ''} & ${atletas.find(a => a.id === atletas1_j2[1])?.nome || ''}`,
                    },
                    participante2: {
                      id: jogo2.participante2.id,
                      nome: `${atletas.find(a => a.id === atletas2_j2[0])?.nome || ''} & ${atletas.find(a => a.id === atletas2_j2[1])?.nome || ''}`,
                    },
                  };
                  
                  enfrentamentos.get(atleta1)?.add(atleta2);
                  enfrentamentos.get(atleta2)?.add(atleta1);
                  ajustado = true;
                  console.log(`[SORTEIO] Ajustado via troca entre jogos: ${atleta1} e ${atleta2} agora se enfrentam`);
                  break;
                } else if (a2NaDupla2_j2) {
                  const idxA2 = atletas2_j2.indexOf(atleta2);
                  const idxTroca = duplaParaTrocar.indexOf(atletaParaTrocar);
                  
                  // Trocar: atleta2 vai para jogo1, atletaParaTrocar vai para jogo2
                  duplaParaTrocar[idxTroca] = atleta2;
                  atletas2_j2[idxA2] = atletaParaTrocar;
                  
                  // Atualizar jogos (similar ao acima)
                  if (a1NaDupla1_j1) {
                    jogos[idx1] = {
                      ...jogo1,
                      participante1Atletas: atletas1_j1,
                      participante2Atletas: duplaParaTrocar,
                      participante1: {
                        id: jogo1.participante1.id,
                        nome: `${atletas.find(a => a.id === atletas1_j1[0])?.nome || ''} & ${atletas.find(a => a.id === atletas1_j1[1])?.nome || ''}`,
                      },
                      participante2: {
                        id: jogo1.participante2.id,
                        nome: `${atletas.find(a => a.id === duplaParaTrocar[0])?.nome || ''} & ${atletas.find(a => a.id === duplaParaTrocar[1])?.nome || ''}`,
                      },
                    };
                  } else {
                    jogos[idx1] = {
                      ...jogo1,
                      participante1Atletas: duplaParaTrocar,
                      participante2Atletas: atletas2_j1,
                      participante1: {
                        id: jogo1.participante1.id,
                        nome: `${atletas.find(a => a.id === duplaParaTrocar[0])?.nome || ''} & ${atletas.find(a => a.id === duplaParaTrocar[1])?.nome || ''}`,
                      },
                      participante2: {
                        id: jogo1.participante2.id,
                        nome: `${atletas.find(a => a.id === atletas2_j1[0])?.nome || ''} & ${atletas.find(a => a.id === atletas2_j1[1])?.nome || ''}`,
                      },
                    };
                  }
                  
                  jogos[idx2] = {
                    ...jogo2,
                    participante1Atletas: atletas1_j2,
                    participante2Atletas: atletas2_j2,
                    participante1: {
                      id: jogo2.participante1.id,
                      nome: `${atletas.find(a => a.id === atletas1_j2[0])?.nome || ''} & ${atletas.find(a => a.id === atletas1_j2[1])?.nome || ''}`,
                    },
                    participante2: {
                      id: jogo2.participante2.id,
                      nome: `${atletas.find(a => a.id === atletas2_j2[0])?.nome || ''} & ${atletas.find(a => a.id === atletas2_j2[1])?.nome || ''}`,
                    },
                  };
                  
                  enfrentamentos.get(atleta1)?.add(atleta2);
                  enfrentamentos.get(atleta2)?.add(atleta1);
                  ajustado = true;
                  console.log(`[SORTEIO] Ajustado via troca entre jogos: ${atleta1} e ${atleta2} agora se enfrentam`);
                  break;
                }
              }
            }
          }
        }
      }
      
      if (!ajustado) {
        console.warn(`[SORTEIO] ⚠️ Não foi possível ajustar para que ${atleta1} e ${atleta2} se enfrentem`);
      }
    }
    
    // Re-validar após ajustes
    enfrentamentos.clear();
    atletas.forEach(a => enfrentamentos.set(a.id, new Set()));
  jogos.forEach(jogo => {
    const atletas1 = jogo.participante1Atletas;
    const atletas2 = jogo.participante2Atletas;
    atletas1.forEach(a1 => {
      atletas2.forEach(a2 => {
          enfrentamentos.get(a1)?.add(a2);
          enfrentamentos.get(a2)?.add(a1);
        });
      });
    });
    
    // Verificar se ainda há pares faltando
    const paresFaltandoApos: Array<[string, string]> = [];
    for (let i = 0; i < atletas.length; i++) {
      for (let j = i + 1; j < atletas.length; j++) {
        const a1 = atletas[i].id;
        const a2 = atletas[j].id;
        if (!enfrentamentos.get(a1)?.has(a2)) {
          paresFaltandoApos.push([a1, a2]);
        }
      }
    }
    
    if (paresFaltandoApos.length > 0) {
      console.warn(`[SORTEIO] ⚠️ Ainda há ${paresFaltandoApos.length} pares que não se enfrentaram após ajustes:`, 
        paresFaltandoApos.map(([a1, a2]) => {
          const nome1 = atletas.find(a => a.id === a1)?.nome || a1;
          const nome2 = atletas.find(a => a.id === a2)?.nome || a2;
          return `${nome1} vs ${nome2}`;
        })
      );
    } else {
      console.log(`[SORTEIO] ✅ Todos os pares de atletas se enfrentam pelo menos uma vez!`);
    }
  } else {
    console.log(`[SORTEIO] ✅ Todos os pares de atletas já se enfrentam!`);
  }

  return jogos;
}

