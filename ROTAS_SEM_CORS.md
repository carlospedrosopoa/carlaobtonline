# Rotas que precisam de CORS adicionado

## Rotas consumidas pelo appatleta.vercel.app que estão SEM CORS:

1. ✅ `/api/bloqueio-agenda` - JÁ CORRIGIDO
2. ✅ `/api/bloqueio-agenda/[id]` - JÁ CORRIGIDO
3. ❌ `/api/point` - GET, POST
4. ❌ `/api/point/[id]` - GET, PUT, DELETE
5. ❌ `/api/quadra/[id]` - GET, PUT, DELETE
6. ❌ `/api/agendamento/[id]` - GET, PUT, DELETE
7. ❌ `/api/agendamento/[id]/cancelar` - POST
8. ❌ `/api/agendamento/limpar-futuros` - POST
9. ❌ `/api/tabela-preco` - GET, POST
10. ❌ `/api/tabela-preco/[id]` - PUT, DELETE
11. ❌ `/api/user/atleta/buscar-por-telefone` - POST
12. ❌ `/api/atleta/[id]` - PUT
13. ❌ `/api/atleta/listarAtletas` - GET
14. ❌ `/api/atleta/para-selecao` - GET
15. ❌ `/api/partida/listarPartidas` - GET
16. ❌ `/api/partida/criarPartida` - POST
17. ❌ `/api/partida/[id]` - PUT
18. ❌ `/api/card/partida/[id]` - GET
19. ❌ `/api/user/list` - GET
20. ❌ `/api/user/[id]` - PUT
21. ❌ `/api/user/getUsuarioLogado` - GET

## Rotas que JÁ TÊM CORS:

- ✅ `/api/quadra` - GET, POST
- ✅ `/api/agendamento` - GET, POST
- ✅ `/api/auth/login` - POST
- ✅ `/api/auth/me` - GET
- ✅ `/api/user/auth/register` - POST
- ✅ `/api/user/auth/me` - GET
- ✅ `/api/user/arenas/listar` - GET
- ✅ `/api/user/perfil/atleta` - GET
- ✅ `/api/user/perfil/criar` - POST
- ✅ `/api/user/perfil/atualizar` - PUT
- ✅ `/api/atleta/me/atleta` - GET
- ✅ `/api/atleta/criarAtleta` - POST
- ✅ `/api/point/public` - GET

