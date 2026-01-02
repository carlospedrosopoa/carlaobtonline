# Análise: Sistema de Colaboradores para Arenas

## Objetivo
Permitir que arenas cadastrem colaboradores que terão usuário e senha para acessar a arena, e rastrear qual usuário realizou cada operação (vincular cliente, criar agendamento, cards de clientes, etc).

## Situação Atual

### Estrutura de Usuários
- Tabela `User` com campos: `id`, `name`, `email`, `password`, `role`, `pointIdGestor`, `createdAt`, `updatedAt`
- Roles existentes: `ADMIN`, `USER`, `ORGANIZER`
- `ORGANIZER` já tem `pointIdGestor` vinculado à arena que gerencia

### Rastreamento Atual
- Tabelas têm `createdAt` e `updatedAt` (timestamps)
- **NÃO há rastreamento de qual usuário criou/modificou** na maioria das tabelas
- Algumas tabelas têm `usuarioId` mas isso se refere ao cliente/atleta, não ao operador

### Operações que Precisam de Rastreamento
1. **Agendamentos** - criar, editar, cancelar
2. **Fluxo de Caixa** - criar entrada/saída, processar pagamento, registrar movimentações financeiras (ALTA PRIORIDADE)
3. **Cards de Clientes** - criar, vincular agendamento, adicionar itens, processar pagamento
4. **Vínculo de Clientes** - vincular/desvincular atleta a agendamento
5. **Competições** - criar, editar, gerenciar
6. **Outras operações administrativas da arena**

## Análise de Abordagens

### Abordagem 1: Novo Role "COLABORADOR"
**Vantagens:**
- Simples de implementar
- Mantém compatibilidade com estrutura atual
- Usa a mesma tabela `User`

**Desvantagens:**
- Mistura colaboradores com gestores e admins
- Dificulta filtragem/permissões específicas
- Não diferencia visualmente colaboradores de gestores

### Abordagem 2: Tabela Separada "Colaborador"
**Vantagens:**
- Separação clara entre colaboradores e gestores
- Permite campos específicos para colaboradores
- Facilita gestão independente

**Desvantagens:**
- Mais complexo de implementar
- Precisa duplicar lógica de autenticação
- Dois sistemas de usuários paralelos

### Abordagem 3: Usar Role "ORGANIZER" com Nível de Permissão (RECOMENDADA)
**Vantagens:**
- Reutiliza estrutura existente
- Já existe `pointIdGestor` para vincular à arena
- Pode diferenciar colaborador vs gestor via campo adicional
- Mantém autenticação unificada

**Estrutura Proposta:**
```sql
-- Adicionar campo na tabela User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ehColaborador" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gestorId" TEXT REFERENCES "User"(id); -- Usuário que criou/gerencia este colaborador

-- Roles continuam: ADMIN, USER, ORGANIZER
-- ORGANIZER pode ser gestor ou colaborador (diferenciado por ehColaborador)
```

## Rastreamento de Operações (Auditoria)

### Abordagem 1: Campos `createdBy` e `updatedBy` em cada tabela
**Vantagens:**
- Simples e direto
- Fácil de consultar
- Padrão comum em sistemas de auditoria

**Estrutura:**
```sql
-- Exemplo para Agendamento
ALTER TABLE "Agendamento" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id);
ALTER TABLE "Agendamento" ADD COLUMN IF NOT EXISTS "updatedById" TEXT REFERENCES "User"(id);

-- Exemplo para CardCliente
ALTER TABLE "CardCliente" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id);
ALTER TABLE "CardCliente" ADD COLUMN IF NOT EXISTS "updatedById" TEXT REFERENCES "User"(id);
```

**Tabelas que precisam:**
1. `Agendamento` - createdById, updatedById
2. **`EntradaCaixa`** - createdById, updatedById (Alta prioridade - operações financeiras)
3. **`SaidaCaixa`** - createdById, updatedById (Alta prioridade - operações financeiras)
4. **`PagamentoCard`** - createdById, updatedById (Alta prioridade - operações financeiras)
5. **`AberturaCaixa`** - createdById, updatedById (Alta prioridade - controle de caixa)
6. `CardCliente` - createdById, updatedById
7. `CardClienteItem` - createdById (opcional updatedById)
8. `CardAgendamento` - createdById (vínculo agendamento-card)
9. `Competicao` - createdById, updatedById
10. `JogoCompeticao` - createdById, updatedById (especialmente para manutenção)
11. `AtletaCompeticao` - createdById (inscrição)
12. Outras operações importantes da arena

**Nota:** As tabelas de fluxo de caixa (`EntradaCaixa`, `SaidaCaixa`, `PagamentoCard`) já possuem o campo `createdBy` na estrutura atual (conforme visto na rota GET que retorna esses campos). Será necessário:
- Verificar se também possuem `updatedBy` ou `updatedById` 
- Se não possuírem, adicionar `updatedBy` ou `updatedById`
- Garantir que esses campos sejam preenchidos em todas as operações (INSERT e UPDATE)
- Verificar se as rotas POST/PUT já preenchem o `createdBy` corretamente

### Abordagem 2: Tabela de Auditoria Separada
**Vantagens:**
- Histórico completo de mudanças
- Não altera estrutura das tabelas principais
- Permite rastreamento mais detalhado

**Desvantagens:**
- Mais complexo
- Consultas mais difíceis
- Pode impactar performance

**Estrutura:**
```sql
CREATE TABLE "Auditoria" (
  id TEXT PRIMARY KEY,
  "tabela" TEXT NOT NULL,
  "registroId" TEXT NOT NULL,
  "acao" TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  "usuarioId" TEXT NOT NULL REFERENCES "User"(id),
  "dadosAnteriores" JSONB,
  "dadosNovos" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Recomendação: Abordagem 1 (Campos createdBy/updatedBy)
- Mais simples
- Consultas diretas nas tabelas
- Performance melhor
- Atende aos requisitos

## Implementação Proposta

### Fase 1: Estrutura de Colaboradores
1. Adicionar campos na tabela `User`:
   - `ehColaborador` BOOLEAN
   - `gestorId` TEXT (referência ao User que criou/gerencia)

2. Criar interface de gestão de colaboradores na arena:
   - Listar colaboradores da arena
   - Criar novo colaborador
   - Editar colaborador
   - Desativar/remover colaborador

### Fase 2: Campos de Auditoria
1. Adicionar `createdById` e `updatedById` nas tabelas principais:
   - **Agendamento** (Alta prioridade)
   - **FluxoCaixa / MovimentacaoCaixa** (Alta prioridade - operações financeiras críticas)
   - **CardCliente** (Alta prioridade)
   - CardClienteItem
   - CardAgendamento
   - Competicao
   - JogoCompeticao
   - AtletaCompeticao

2. Atualizar todas as operações de CREATE/UPDATE para preencher esses campos:
   - Obter `usuario.id` do token JWT
   - Definir `createdById` no INSERT
   - Definir `updatedById` no UPDATE

### Fase 3: Migração de Dados Existentes
- Para registros existentes sem `createdById`, pode deixar NULL ou usar um usuário padrão
- Opcional: identificar usuário original quando possível

### Fase 4: Interface de Visualização
- Mostrar "Criado por" e "Modificado por" nas interfaces relevantes
- Filtros por colaborador/usuário
- Relatórios de atividade por colaborador

## Considerações Importantes

### Permissões
- Colaboradores devem ter acesso limitado à arena (pointIdGestor)
- Não devem poder criar outros colaboradores (apenas gestores)
- Podem ter diferentes níveis de permissão (futuro)

### Segurança
- Sempre obter `usuario.id` do token JWT (não confiar no frontend)
- Validar que colaborador pertence à arena correta
- Registrar TODAS as operações importantes

### Performance
- Índices nos campos `createdById` e `updatedById`
- Considerar particionamento se volume de dados crescer muito

### Compatibilidade
- Campos de auditoria devem ser NULLABLE inicialmente
- Sistema deve funcionar mesmo sem esses campos preenchidos (dados antigos)

## Tabelas Prioritárias para Implementação

1. **Agendamento** - Alta prioridade (operação mais comum)
2. **FluxoCaixa / MovimentacaoCaixa** - Alta prioridade (operações financeiras críticas - entradas, saídas, pagamentos)
3. **CardCliente** - Alta prioridade (operação financeira importante)
4. **Competicao** - Média prioridade
5. **Outras operações** - Baixa prioridade (implementar conforme necessidade)

## Exemplo de Implementação

```typescript
// Exemplo de atualização em uma rota API
export async function POST(request: NextRequest) {
  const usuario = await getUsuarioFromRequest(request);
  if (!usuario) {
    return NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  
  // Inserir com createdById
  const result = await query(
    `INSERT INTO "Agendamento" (..., "createdById", "createdAt")
     VALUES (..., $1, NOW())
     RETURNING *`,
    [usuario.id, ...outrosValores]
  );

  return NextResponse.json(result.rows[0]);
}

export async function PUT(request: NextRequest, { params }) {
  const usuario = await getUsuarioFromRequest(request);
  if (!usuario) {
    return NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Atualizar com updatedById
  const result = await query(
    `UPDATE "Agendamento"
     SET ..., "updatedById" = $1, "updatedAt" = NOW()
     WHERE id = $2
     RETURNING *`,
    [usuario.id, id]
  );

  return NextResponse.json(result.rows[0]);
}
```

## Próximos Passos
1. Definir abordagem final (recomendado: Role ORGANIZER + ehColaborador)
2. Criar migration para adicionar campos
3. Implementar interface de gestão de colaboradores
4. Adicionar campos de auditoria nas tabelas prioritárias
5. Atualizar rotas API para preencher campos de auditoria
6. Testar e validar
7. Expandir para outras tabelas conforme necessidade

