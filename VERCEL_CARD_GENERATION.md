# Geração de Cards no Vercel

## ✅ Compatibilidade

As alterações implementadas **funcionam normalmente no Vercel** com as seguintes considerações:

### 1. **Axios**
- ✅ **Funciona perfeitamente** no Vercel com Node.js Runtime
- ✅ Não requer configuração especial
- ✅ Usado para carregar imagens do Google Cloud Storage

### 2. **Canvas (node-canvas)**
- ✅ **Funciona no Vercel** com Node.js Runtime
- ✅ Já está instalado como dependência (`canvas: ^3.2.0`)
- ✅ Usado para desenhar o card promocional

### 3. **Sharp**
- ✅ **Funciona no Vercel** com Node.js Runtime
- ✅ Já está instalado como dependência (`sharp: ^0.34.5`)
- ✅ Usado para processamento de imagens

## ⚙️ Configuração do Vercel

O arquivo `vercel.json` já está configurado com:

```json
{
  "version": 2,
  "functions": {
    "src/app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    },
    "src/app/api/card/**/*.ts": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

### Por que configuração especial para `/api/card/**`?

- **Memória (3008MB)**: Geração de imagens com Canvas requer mais memória
- **Timeout (60s)**: Carregar 4 imagens do GCS + gerar card pode levar tempo

## 🔧 Variáveis de Ambiente Necessárias

No Vercel, configure estas variáveis em **Settings → Environment Variables**:

### Obrigatórias:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=sua-chave-secreta
```

### Para Google Cloud Storage:
```env
GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name
```

**Nota**: Não é necessário `GOOGLE_APPLICATION_CREDENTIALS` no Vercel. A autenticação é automática via Application Default Credentials (ADC).

## 🚀 Como Funciona no Vercel

1. **Requisição chega** → `/api/card/partida/[id]`
2. **Autenticação** → Verifica token JWT
3. **Busca dados** → Consulta PostgreSQL (Neon)
4. **Carrega imagens** → Axios faz requisições HTTP para URLs do GCS
5. **Gera card** → Canvas desenha o card com fotos e textos
6. **Retorna PNG** → Buffer convertido em resposta HTTP

## ⚠️ Limitações e Considerações

### Timeout
- **Padrão**: 10 segundos para carregar cada imagem do GCS
- **Total**: Máximo 60 segundos para gerar o card completo
- Se uma imagem demorar muito, será usado avatar padrão

### Memória
- **Padrão**: 1024MB para outras rotas
- **Card**: 3008MB para geração de cards
- Imagens grandes podem consumir mais memória

### Cache
- Cards são gerados **on-demand** (não são salvos)
- Headers de cache configurados para 1 hora (`Cache-Control: public, max-age=3600`)
- Vercel pode fazer cache automático da resposta

## 🐛 Troubleshooting

### Problema: Timeout ao gerar card
**Solução**: Verifique se as URLs do GCS estão acessíveis e se as imagens não são muito grandes.

### Problema: Erro "Canvas não encontrado"
**Solução**: Certifique-se de que `canvas` está em `dependencies` (não `devDependencies`).

### Problema: Imagens não carregam
**Solução**: 
1. Verifique se as URLs do GCS estão corretas
2. Verifique logs do Vercel para erros de axios
3. Confirme que as imagens são públicas no GCS

## 📊 Monitoramento

No Vercel Dashboard, você pode monitorar:
- **Tempo de execução** das funções
- **Uso de memória**
- **Logs** em tempo real
- **Erros** e stack traces

## ✅ Checklist de Deploy

Antes de fazer deploy, certifique-se de:

- [ ] `vercel.json` está commitado
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] `axios` está em `dependencies` (não `devDependencies`)
- [ ] `canvas` está em `dependencies`
- [ ] `sharp` está em `dependencies`
- [ ] URLs do GCS são públicas e acessíveis
- [ ] Teste local funcionando

## 🎯 Conclusão

**Sim, as alterações funcionam normalmente no Vercel!** 

O código está preparado para:
- ✅ Carregar imagens do GCS usando axios
- ✅ Gerar cards com Canvas
- ✅ Processar imagens com Sharp
- ✅ Funcionar em ambiente serverless

A única diferença entre local e Vercel é que no Vercel você não precisa configurar `GOOGLE_APPLICATION_CREDENTIALS` (ADC automático).

