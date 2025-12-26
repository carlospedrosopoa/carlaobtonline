# Instruções para Executar Migrações

## Migrações Necessárias para o Módulo de Competições

### 1. Primeiro, execute a migração do módulo de competições (se ainda não foi executada):

Arquivo: `migrations/create_modulo_competicoes.sql`

Este arquivo cria:
- Tabela `Competicao`
- Tabela `AtletaCompeticao`
- Índices e triggers necessários

### 2. Depois, execute a migração de jogos da competição:

Arquivo: `migrations/create_jogos_competicao.sql`

Este arquivo cria:
- Tabela `JogoCompeticao`
- Índices necessários
- Trigger para atualizar `updatedAt`

## Como Executar no Neon (Banco de Dados de Produção)

1. Acesse o painel do Neon: https://console.neon.tech
2. Selecione seu projeto
3. Vá em "SQL Editor"
4. Copie e cole o conteúdo do arquivo `create_modulo_competicoes.sql` (se ainda não foi executado)
5. Clique em "Run" para executar
6. Depois, copie e cole o conteúdo do arquivo `create_jogos_competicao.sql`
7. Clique em "Run" para executar

## Ordem de Execução

**IMPORTANTE:** Execute na seguinte ordem:

1. `create_modulo_competicoes.sql` (primeiro - cria as tabelas base)
2. `create_jogos_competicao.sql` (segundo - depende da tabela Competicao)

## Verificação

Após executar as migrações, você pode verificar se as tabelas foram criadas executando:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('Competicao', 'AtletaCompeticao', 'JogoCompeticao');
```

Deve retornar 3 linhas com os nomes das tabelas.

