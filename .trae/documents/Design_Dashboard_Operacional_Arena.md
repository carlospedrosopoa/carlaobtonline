# Design — Dashboard Operacional da Arena (Desktop-first)

## 1) Layout
- Abordagem: desktop-first com CSS Grid para estrutura (sidebar/topbar + conteúdo) e Flexbox dentro de cards.
- Grid base (>= 1200px):
  - Coluna 1: navegação/atalhos (opcional, conforme layout atual do produto).
  - Coluna 2: conteúdo principal (largura fluida).
- Breakpoints sugeridos:
  - >=1200px: 3 colunas de cards (KPIs) e gráficos lado a lado.
  - 768–1199px: 2 colunas.
  - <768px: 1 coluna (stack), gráficos em largura total.
- Espaçamento: 24px entre seções; 16px entre elementos internos; 8px para micro espaçamentos.

## 2) Meta Information
- Title: "Dashboard Operacional da Arena"
- Description: "Métricas de agendamentos e comandas com filtros por período."
- Open Graph:
  - og:title: "Dashboard Operacional da Arena"
  - og:description: "Visão operacional de agendamentos e consumo com filtros por período."
  - og:type: "website"

## 3) Global Styles
- Background: #0B1220 (ou fundo neutro do sistema) com superfície de cards #111B2E.
- Texto primário: #E6EAF2; secundário: #A7B0C0.
- Accent/Primary: #3B82F6.
- Tipografia (escala):
  - H1: 24–28px / semibold
  - H2: 18–20px / semibold
  - Body: 14–16px
  - Caption: 12px
- Botões:
  - Primário: fundo accent, texto branco; hover escurece ~8%.
  - Secundário: borda/surface; hover eleva (shadow leve).
- Inputs e selects:
  - Altura 40px; borda 1px; foco com outline accent.
- Estados:
  - Loading: skeleton nos cards e áreas de gráfico.
  - Empty: mensagem curta + sugestão "Ajuste o período".
  - Error: alerta inline no topo do conteúdo.

## 4) Page Structure
Padrão de página em seções empilhadas:
1. Cabeçalho (título + filtros principais)
2. Linha de KPIs (cards)
3. Seção Agendamentos (duração + gráfico por turno/dia)
4. Seção Comandas (produtos mais consumidos)

## 5) Sections & Components

## 5.1 Cabeçalho + Filtros
- Componente: "PageHeader"
  - Esquerda: título "Dashboard Operacional" + subtítulo com período atual.
  - Direita: barra de filtros.
- Filtros (em uma faixa horizontal no desktop):
  - DateRangePicker (Data inicial, Data final)
  - Botão "Aplicar"
  - Botão "Limpar" (volta para padrão do sistema)
- Interações:
  - Aplicar dispara recálculo/refresh dos blocos (KPIs, gráficos, rankings).
  - Desabilitar botão "Aplicar" se datas inválidas/incompletas.

## 5.2 KPIs (Agendamentos)
- Componentes: "KpiCard" (2–4 cards, conforme dados disponíveis)
  - Card 1: "Total de agendamentos"
  - Card 2: "Horas agendadas" (soma de duração)
  - (Opcional, se já existir no backend): "Ticket médio de duração" ou "Média por agendamento"
- Estrutura do card:
  - Título pequeno
  - Valor grande
  - Caption com observação do período

## 5.3 Duração mais consumida
- Componente: "RankingList" ou "BarList"
- Conteúdo:
  - Lista ordenada de durações (ex.: 60, 90, 120 min) com contagem/percentual.
- Interações:
  - Tooltip ao passar o mouse (percentual no período).

## 5.4 Gráfico por turno e dia da semana
- Componentes:
  - "ChartCard" com:
    - Tabs: "Por turno" e "Por dia da semana" (ou dois gráficos lado a lado no desktop).
  - Gráfico recomendado:
    - Turno: barras (manhã/tarde/noite).
    - Dia da semana: barras (Seg–Dom) ou linha.
- Regras de exibição:
  - Eixo Y: quantidade de agendamentos (ou horas, se alternância existir).
  - Legenda visível e rótulos curtos.

## 5.5 Produtos mais consumidos (Comandas)
- Componentes:
  - "TableCard" (tabela) ou "BarList"
- Campos mínimos:
  - Produto
  - Quantidade consumida
- Comportamentos:
  - Ordenação padrão por quantidade desc.
  - Exibir top N (ex.: 10) com scroll interno se necessário.

## 5.6 Acessibilidade e usabilidade
- Contraste adequado em cards e textos.
- Navegação por teclado nos filtros.
- Labels visíveis e mensagens de validação no date range.
- Loading não bloqueante (mantém layout estável com skeleton).