# Proposta: Sistema de Ranking e Jogos das Panelinhas

## Visão Geral

Cada panelinha terá seu próprio sistema de ranking interno, com jogos específicos da panelinha que também aparecerão em "Meus Jogos" do atleta.

## Arquitetura Proposta

### 1. Estrutura de Dados

#### 1.1. Tabela `PartidaPanelinha`
Jogos específicos de uma panelinha, vinculados à estrutura existente de `Partida`.

```sql
CREATE TABLE "PartidaPanelinha" (
  id TEXT PRIMARY KEY,
  "partidaId" TEXT NOT NULL REFERENCES "Partida"(id) ON DELETE CASCADE,
  "panelinhaId" TEXT NOT NULL REFERENCES "Panelinha"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("partidaId", "panelinhaId")
);
```

**Vantagens:**
- Reutiliza a estrutura existente de `Partida`
- Permite que uma partida pertença a múltiplas panelinhas (se necessário)
- Mantém integridade referencial

#### 1.2. Tabela `RankingPanelinha`
Armazena o ranking de cada atleta em cada panelinha.

```sql
CREATE TABLE "RankingPanelinha" (
  id TEXT PRIMARY KEY,
  "panelinhaId" TEXT NOT NULL REFERENCES "Panelinha"(id) ON DELETE CASCADE,
  "atletaId" TEXT NOT NULL REFERENCES "Atleta"(id) ON DELETE CASCADE,
  "pontuacao" INTEGER DEFAULT 0, -- Total de pontos (vitórias + derrotas no tie break)
  "vitorias" INTEGER DEFAULT 0,
  "derrotas" INTEGER DEFAULT 0,
  "derrotasTieBreak" INTEGER DEFAULT 0, -- Derrotas que foram no tie break (ganham 1 ponto)
  "partidasJogadas" INTEGER DEFAULT 0,
  "saldoGames" INTEGER DEFAULT 0, -- Saldo de games (games feitos - games sofridos) para desempate
  "gamesFeitos" INTEGER DEFAULT 0, -- Total de games feitos
  "gamesSofridos" INTEGER DEFAULT 0, -- Total de games sofridos
  "posicao" INTEGER, -- Posição no ranking (calculada)
  "ultimaAtualizacao" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("panelinhaId", "atletaId")
);
```

**Campos de Ranking:**
- `pontuacao`: Total de pontos (vitórias = 3, derrotas no tie break = 1, derrotas normais = 0)
- `vitorias`: Número de vitórias
- `derrotas`: Número de derrotas (inclui tie break)
- `derrotasTieBreak`: Derrotas que foram no tie break (para estatísticas)
- `partidasJogadas`: Total de partidas
- `saldoGames`: Games feitos - games sofridos (para critério de desempate)
- `gamesFeitos`: Total de games marcados
- `gamesSofridos`: Total de games recebidos
- `posicao`: Posição atual no ranking (calculada dinamicamente)

#### 1.3. Modificação na Tabela `Partida` (Opcional)
Adicionar campo opcional para indicar se é um jogo de panelinha:

```sql
ALTER TABLE "Partida" 
ADD COLUMN IF NOT EXISTS "panelinhaId" TEXT REFERENCES "Panelinha"(id);
```

**Nota:** Isso é opcional se usarmos apenas `PartidaPanelinha` para o relacionamento.

### 2. Fluxo de Funcionamento

#### 2.1. Criar Jogo na Panelinha
1. Usuário acessa a panelinha
2. Clica em "Novo Jogo" ou "Montar Jogo"
3. Sistema mostra:
   - Lista de membros da panelinha (filtrados por esporte, se houver)
   - Seleção de formato (simples, duplas, etc.)
   - Seleção de data/hora
   - Seleção de local/quadra (opcional)
4. Ao criar, sistema:
   - Cria registro em `Partida` (estrutura existente)
   - Cria registro em `PartidaPanelinha` (vincula à panelinha)
   - Atualiza rankings automaticamente após resultado

#### 2.2. Recurso Prático para Montar Jogos
**Sugestão de Interface:**
- **Modo Rápido**: Selecionar 2 ou 4 membros e criar jogo instantaneamente
- **Modo Torneio**: Criar múltiplos jogos de uma vez (round-robin, eliminatório)
- **Sugestão Automática**: Sistema sugere combinações baseadas em:
  - Ranking similar (jogos balanceados)
  - Últimos oponentes (evitar repetições)
  - Disponibilidade (se integrar com agendamentos)

#### 2.3. Atualização de Ranking
Após registrar resultado de uma partida:
1. Sistema calcula pontos baseado em:
   - **Vitória**: +3 pontos
   - **Derrota no tie break**: +1 ponto (quando `tiebreakTime1` ou `tiebreakTime2` não é null)
   - **Derrota normal**: +0 pontos
2. Sistema calcula saldo de games:
   - `gamesFeitos`: Soma dos games do time do atleta
   - `gamesSofridos`: Soma dos games do time adversário
   - `saldoGames`: `gamesFeitos - gamesSofridos`
3. Atualiza `RankingPanelinha` para todos os atletas envolvidos:
   - Incrementa `partidasJogadas`
   - Atualiza `pontuacao`, `vitorias`, `derrotas`, `derrotasTieBreak`
   - Atualiza `gamesFeitos`, `gamesSofridos`, `saldoGames`
4. Recalcula posições no ranking:
   - Ordena por: `pontuacao DESC, saldoGames DESC`
   - Atualiza campo `posicao` para cada atleta

#### 2.4. Exibição em "Meus Jogos"
- Filtrar partidas que têm `PartidaPanelinha` vinculada
- Mostrar badge/indicador de qual panelinha é
- Permitir filtrar por panelinha
- Manter todas as funcionalidades existentes (atualizar placar, gerar card, etc.)

### 3. Interface do Usuário

#### 3.1. Página da Panelinha
**Aba "Ranking":**
- Tabela de ranking com:
  - Posição
  - Nome do atleta (com foto)
  - Pontuação
  - Estatísticas (V/D/E)
  - Gráfico de evolução (opcional)

**Aba "Jogos":**
- Lista de jogos da panelinha
- Filtros: por data, por atleta, por status
- Botão "Novo Jogo" com modal prático

**Aba "Membros":**
- Lista atual de membros
- Estatísticas individuais

#### 3.2. Modal "Montar Jogo"
**Design Prático:**
```
┌─────────────────────────────────┐
│  Montar Jogo - [Nome Panelinha] │
├─────────────────────────────────┤
│ Formato: [Simples] [Duplas]     │
│                                  │
│ Selecionar Jogadores:            │
│ ☐ Atleta 1 (Ranking: 5º)        │
│ ☐ Atleta 2 (Ranking: 3º)         │
│ ☐ Atleta 3 (Ranking: 1º)         │
│ ☐ Atleta 4 (Ranking: 2º)         │
│                                  │
│ [Sugerir Combinação]             │
│                                  │
│ Data/Hora: [__/__/____] [__:__] │
│ Local: [Opcional]                │
│                                  │
│ [Cancelar] [Criar Jogo]          │
└─────────────────────────────────┘
```

**Recursos:**
- Drag & drop para formar times (duplas)
- Sugestão automática de combinações balanceadas
- Validação: mínimo de jogadores, formato correto

### 4. Sistema de Pontuação (DEFINIDO)

#### Regras de Pontuação:
- **Vitória**: +3 pontos
- **Derrota no tie break**: +1 ponto (quando a partida teve tie break)
- **Derrota normal**: +0 pontos

#### Critério de Desempate:
Quando dois ou mais atletas têm a mesma pontuação, o desempate é feito por:
1. **Saldo de Games** (maior saldo = melhor posição)
   - `saldoGames = gamesFeitos - gamesSofridos`
   - Exemplo: Atleta A fez 50 games e sofreu 40 = saldo +10
   - Exemplo: Atleta B fez 45 games e sofreu 35 = saldo +10 (empate no saldo)
2. Se ainda houver empate no saldo, pode usar:
   - Total de games feitos (maior = melhor)
   - Ou ordem alfabética (último critério)

#### Exemplo de Cálculo:
```
Partida 1: Atleta A vence 7x5
- Atleta A: +3 pontos, +7 games feitos, +5 games sofridos, saldo +2
- Atleta B: +0 pontos, +5 games feitos, +7 games sofridos, saldo -2

Partida 2: Atleta A perde 6x7 (7x6 no tie break)
- Atleta A: +1 ponto (derrota no tie break), +6 games feitos, +7 games sofridos, saldo -1
- Atleta B: +3 pontos, +7 games feitos, +6 games sofridos, saldo +1

Total Atleta A: 4 pontos, 13 games feitos, 12 games sofridos, saldo +1
Total Atleta B: 3 pontos, 12 games feitos, 13 games sofridos, saldo -1
```

#### Detecção de Tie Break:
Uma partida teve tie break quando:
- `tiebreakTime1 IS NOT NULL` OU `tiebreakTime2 IS NOT NULL`
- Isso indica que pelo menos um set foi decidido no tie break

### 5. Integração com Sistema Existente

#### 5.1. Reutilização de Código
- Usar componentes existentes de `Partida`
- Reutilizar modal de atualizar placar
- Reutilizar geração de card de partida
- Adicionar badge "Panelinha" nos cards

#### 5.2. APIs Necessárias

**Novas Rotas:**
- `GET /api/user/panelinha/[id]/ranking` - Obter ranking da panelinha
- `GET /api/user/panelinha/[id]/jogos` - Listar jogos da panelinha
- `POST /api/user/panelinha/[id]/jogo` - Criar jogo na panelinha
- `GET /api/user/panelinha/[id]/sugerir-jogo` - Sugerir combinação de jogadores
- `PUT /api/user/panelinha/[id]/ranking/recalcular` - Recalcular ranking (admin)

**Modificações em Rotas Existentes:**
- `GET /api/partida/listarPartidas` - Adicionar filtro por `panelinhaId`
- `POST /api/partida` - Aceitar `panelinhaId` opcional

### 6. Vantagens desta Arquitetura

✅ **Reutilização**: Aproveita estrutura existente de `Partida`  
✅ **Flexibilidade**: Uma partida pode estar em múltiplas panelinhas  
✅ **Escalabilidade**: Fácil adicionar novos tipos de ranking  
✅ **Consistência**: Jogos aparecem em "Meus Jogos" automaticamente  
✅ **Praticidade**: Interface simples para montar jogos rapidamente  

### 7. Considerações Técnicas

#### 7.1. Performance
- Índices em `RankingPanelinha(panelinhaId, atletaId)`
- Cache de rankings (atualizar apenas quando necessário)
- Paginação em listas de jogos

#### 7.2. Consistência
- Trigger ou função para atualizar ranking automaticamente após partida
- Validação: apenas membros da panelinha podem criar jogos
- Histórico de mudanças de ranking (opcional)

#### 7.3. Permissões
- Apenas membros da panelinha podem:
  - Ver ranking
  - Criar jogos
  - Ver jogos
- Criador da panelinha pode:
  - Recalcular ranking
  - Gerenciar membros
  - Deletar panelinha

## Próximos Passos (quando implementar)

1. Criar migrations para novas tabelas
2. Implementar APIs de ranking e jogos
3. Criar interface de montar jogo (modal prático)
4. Implementar cálculo de ranking
5. Integrar com "Meus Jogos"
6. Adicionar gráficos e estatísticas
7. Testes e refinamentos

## Perguntas para Refinamento

1. ~~**Sistema de pontuação**: Qual prefere? (Simples, ELO, Híbrido)~~ ✅ **DEFINIDO**
2. **Formato de jogos**: Apenas duplas ou também simples?
3. **Histórico**: Manter histórico de posições no ranking?
4. **Notificações**: Notificar membros quando novo jogo é criado?
5. **Torneios**: Implementar sistema de torneios dentro da panelinha?
6. **Desempate adicional**: Se houver empate no saldo de games, qual o próximo critério? (Total de games feitos, ordem alfabética, confronto direto?)

