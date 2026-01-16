# Especificação de Design — Tela de Histórico do Atleta (Arena)

## 1) Layout
- Abordagem desktop-first (largura base 1200–1440px), com container central e respiro lateral.
- Layout híbrido: barra superior fixa + conteúdo em coluna (stacked sections) + tabelas em largura total.
- CSS: Flexbox para header/filtros e alinhamentos; CSS Grid opcional para área de filtros (campos com larguras proporcionais).
- Responsivo:
  - >= 1024px: filtros em linha (busca + período + ações).
  - < 1024px: filtros quebram em 2 linhas.
  - < 640px: filtros em coluna; abas viram dropdown/segmented control rolável.

## 2) Meta Information
- Title: "Histórico do Atleta | Arena"
- Description: "Consulte consumo, pagamentos, conta corrente e agendamentos do atleta com filtros por período."
- Open Graph:
  - og:title: "Histórico do Atleta | Arena"
  - og:description: igual à description
  - og:type: "website"

## 3) Global Styles
- Cores (tokens sugeridos):
  - background: #0B0F17 (ou #FFFFFF se tema claro já existir)
  - surface/card: #111827
  - border: #243042
  - text-primary: #E5E7EB; text-secondary: #9CA3AF
  - accent/primary: #2563EB
  - success: #16A34A; warning: #F59E0B; danger: #DC2626
- Tipografia:
  - Base 14–16px; títulos 18–24px; números monetários com tabular-nums.
- Botões:
  - Primário (Aplicar): fundo accent, hover +8% brilho.
  - Secundário (Limpar): outline/borda.
  - Estados: disabled com opacidade 50%.
- Links: sublinhado no hover; cor accent.

## 4) Page Structure
Estrutura em 4 blocos principais:
1. Topbar/Heading
2. Faixa de filtros (busca + período + ações)
3. Abas (Consumo / Pagamentos / Conta Corrente / Agendamentos)
4. Área de resultados (tabela + paginação/scroll + detalhe)

## 5) Sections & Components

### 5.1 Header (Topo)
- Breadcrumb (opcional se já existir no app): "Arena / Histórico do Atleta".
- H1: "Histórico do Atleta".
- Subtítulo: "Busque um atleta e aplique o período para visualizar.".

### 5.2 Barra de Filtros
**Objetivo:** definir contexto (atleta) + recorte temporal.
- Campo: "Buscar atleta" (input com autocomplete)
  - Placeholder: "Nome, documento ou código".
  - Comportamento: ao digitar, exibir lista de sugestões; ao selecionar, fixa “Atleta selecionado: {nome}”.
- Período:
  - Date picker "De" e "Até".
  - Validação: impedir aplicar se De > Até; exibir mensagem inline.
- Ações:
  - Botão primário: "Aplicar"
  - Botão secundário: "Limpar"
- Estados:
  - Sem atleta selecionado: abas e resultados ficam desabilitados e mostram empty state orientando buscar atleta.

### 5.3 Abas de Conteúdo
- Componente de Tabs com 4 itens:
  1) Consumo
  2) Pagamentos
  3) Conta Corrente
  4) Agendamentos
- Indicador visual de aba ativa (sublinhado/accent).
- Mantém atleta e período ao alternar abas.

### 5.4 Tabelas (Resultados)
**Padrão comum nas 4 abas:**
- Cabeçalho de tabela sticky (quando houver scroll vertical).
- Coluna “Data/Hora” sempre presente.
- Linhas clicáveis para abrir detalhe.
- Empty state por aba: "Nenhum registro no período".
- Loading: skeleton de 5–8 linhas.
- Error: banner inline com ação "Tentar novamente".

**Consumo — colunas sugeridas**
- Data/Hora | Item | Qtde | Valor | Observação (truncada)

**Pagamentos — colunas sugeridas**
- Data/Hora | Método | Valor | Status | Referência

**Conta Corrente — colunas sugeridas**
- Data/Hora | Tipo (Crédito/Débito) | Valor | Origem | Referência
- Se houver saldo calculado: mostrar “Saldo atual” como KPI pequeno acima da tabela.

**Agendamentos — colunas sugeridas**
- Início | Fim | Recurso/Quadra | Modalidade | Status

### 5.5 Detalhe do Registro
- Padrão: Drawer lateral (desktop) e Bottom sheet (mobile).
- Conteúdo: lista de campos (label + valor), incluindo IDs/referências quando existirem.
- Ação: "Fechar".

### 5.6 Acessibilidade e Interações
- Navegação por teclado: Tab navega filtros → abas → tabela; Enter abre detalhe.
- Contraste mínimo AA.
- Feedback visual claro para foco (focus ring).
- Transições: 150–200ms (fade/slide) para troca de aba e abertura do drawer.