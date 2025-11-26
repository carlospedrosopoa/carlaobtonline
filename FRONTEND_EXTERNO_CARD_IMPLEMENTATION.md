# Implementação de Cards de Partida - Frontend Externo

## 📋 Visão Geral

Este documento descreve como implementar a funcionalidade de visualização e download de cards promocionais de partidas no frontend externo.

## 🎯 Funcionalidade

O sistema gera cards promocionais em PNG (1080x1920px) para cada partida, contendo:
- Logo e informações da partida (título, data, hora, local)
- Fotos dos 4 atletas participantes
- Nomes dos atletas
- Placar (se disponível)
- Template de fundo personalizado

## 🔌 API Endpoint

### GET `/api/card/partida/[id]`

Gera e retorna o card promocional da partida em formato PNG.

**URL Base:** `https://sua-api.vercel.app/api/card/partida/[id]`

**Autenticação:** Requerida (Bearer Token ou Basic Auth)

**Parâmetros:**
- `id` (path): ID da partida
- `refresh` (query, opcional): `true` para forçar regeneração (ignora cache)
- `nocache` (query, opcional): `true` (mesmo que `refresh=true`)

**Headers:**
```
Authorization: Bearer SEU_TOKEN_JWT
```

**Response:**
- **Content-Type:** `image/png`
- **Status:** `200 OK`
- **Body:** Buffer/Blob da imagem PNG

**Cache:**
- Por padrão: Cache de 1 hora (`Cache-Control: public, max-age=3600`)
- Com `?refresh=true`: Sem cache (`Cache-Control: no-cache`)

## 💻 Implementação

### Exemplo 1: React com Fetch API

```typescript
import { useState } from 'react';

interface CardModalProps {
  partidaId: string;
  onClose: () => void;
}

export function CardModal({ partidaId, onClose }: CardModalProps) {
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadCard = async (forceRefresh = false) => {
    setLoading(true);
    setError(false);
    setCardImageUrl(null);

    try {
      const token = localStorage.getItem('accessToken'); // Ou como você armazena o token
      const url = `${API_BASE_URL}/card/partida/${partidaId}${forceRefresh ? '?refresh=true' : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setCardImageUrl(imageUrl);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar card:', err);
      setError(true);
      setLoading(false);
    }
  };

  // Carregar ao abrir o modal
  useEffect(() => {
    loadCard();
  }, [partidaId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}>✕</button>
        
        <h2>Card da Partida</h2>
        <p>Compartilhe nas redes sociais</p>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Gerando card...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>Erro ao carregar o card</p>
            <button onClick={() => loadCard(true)}>Tentar Novamente</button>
          </div>
        )}

        {cardImageUrl && (
          <>
            <img 
              src={cardImageUrl} 
              alt="Card da Partida" 
              className="card-image"
            />
            
            <div className="actions">
              <a 
                href={cardImageUrl} 
                download={`card-partida-${partidaId}.png`}
                className="btn-download"
              >
                📥 Baixar Card
              </a>
              
              <button 
                onClick={() => {
                  window.open(cardImageUrl, '_blank');
                }}
                className="btn-open"
              >
                🔗 Abrir em Nova Aba
              </button>
              
              <button 
                onClick={() => loadCard(true)}
                className="btn-refresh"
              >
                🔄 Regenerar Card
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

### Exemplo 2: React com Axios

```typescript
import axios from 'axios';
import { useState, useEffect } from 'react';

export function useCard(partidaId: string | null) {
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCard = async (forceRefresh = false) => {
    if (!partidaId) return;

    setLoading(true);
    setError(null);
    setCardUrl(null);

    try {
      const response = await axios.get(
        `/api/card/partida/${partidaId}${forceRefresh ? '?refresh=true' : ''}`,
        {
          responseType: 'blob',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
          },
        }
      );

      const blob = new Blob([response.data], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      setCardUrl(url);
      setLoading(false);
    } catch (err: any) {
      console.error('Erro ao carregar card:', err);
      setError(err.response?.data?.mensagem || 'Erro ao carregar card');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (partidaId) {
      loadCard();
    }

    // Cleanup: revogar URL do blob quando componente desmontar
    return () => {
      if (cardUrl) {
        URL.revokeObjectURL(cardUrl);
      }
    };
  }, [partidaId]);

  return {
    cardUrl,
    loading,
    error,
    refresh: () => loadCard(true),
  };
}

// Uso do hook
function PartidaCard({ partidaId }: { partidaId: string }) {
  const { cardUrl, loading, error, refresh } = useCard(partidaId);

  return (
    <div>
      {loading && <p>Carregando card...</p>}
      {error && <p>Erro: {error}</p>}
      {cardUrl && (
        <>
          <img src={cardUrl} alt="Card da Partida" />
          <button onClick={refresh}>🔄 Regenerar</button>
        </>
      )}
    </div>
  );
}
```

### Exemplo 3: Vanilla JavaScript

```javascript
async function loadCard(partidaId, forceRefresh = false) {
  const token = localStorage.getItem('accessToken');
  const url = `${API_BASE_URL}/card/partida/${partidaId}${forceRefresh ? '?refresh=true' : ''}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ${response.status}`);
    }

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    
    // Exibir imagem
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Card da Partida';
    document.getElementById('card-container').appendChild(img);
    
    // Botão de download
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `card-partida-${partidaId}.png`;
    downloadLink.textContent = 'Baixar Card';
    document.getElementById('card-container').appendChild(downloadLink);
    
  } catch (error) {
    console.error('Erro ao carregar card:', error);
    alert('Erro ao carregar card. Tente novamente.');
  }
}

// Uso
loadCard('abc-123-def-456');
```

## 🎨 Estilos CSS Sugeridos

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  position: relative;
}

.card-image {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  margin: 20px 0;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

.btn-download,
.btn-open,
.btn-refresh {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-download {
  background: #10b981;
  color: white;
}

.btn-open {
  background: #3b82f6;
  color: white;
}

.btn-refresh {
  background: #6b7280;
  color: white;
}

.loading {
  text-align: center;
  padding: 40px;
}

.spinner {
  border: 4px solid #f3f4f6;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

## 🔄 Controle de Cache

### Quando usar `?refresh=true`:

1. **Forçar regeneração:** Quando você quer garantir que o card seja gerado novamente
2. **Depois de atualizar dados:** Após alterar placar, atletas, ou outras informações da partida
3. **Depois de mudar template:** Quando o template padrão foi alterado
4. **Debugging:** Para testar mudanças no layout do card

### Quando NÃO usar (usar cache):

- **Performance:** Para carregar mais rápido em requisições subsequentes
- **Economia de recursos:** Reduz carga no servidor
- **Experiência do usuário:** Cards carregam instantaneamente do cache

## ⚠️ Tratamento de Erros

```typescript
try {
  const response = await fetch(url, { /* ... */ });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expirado - redirecionar para login
      redirectToLogin();
      return;
    }
    
    if (response.status === 404) {
      // Partida não encontrada
      showError('Partida não encontrada');
      return;
    }
    
    if (response.status === 400) {
      // Partida inválida (menos de 2 atletas)
      showError('Partida deve ter pelo menos 2 atletas');
      return;
    }
    
    // Outros erros
    const errorData = await response.json().catch(() => ({}));
    showError(errorData.mensagem || 'Erro ao gerar card');
    return;
  }
  
  // Sucesso - processar blob
  const blob = await response.blob();
  // ...
  
} catch (error) {
  console.error('Erro de rede:', error);
  showError('Erro de conexão. Verifique sua internet.');
}
```

## 📱 Compartilhamento em Redes Sociais

### WhatsApp

```typescript
function shareOnWhatsApp(cardUrl: string) {
  // Primeiro, você precisa fazer upload da imagem para um serviço público
  // ou usar a URL direta se estiver acessível publicamente
  
  const text = encodeURIComponent('Confira o card da partida!');
  const whatsappUrl = `https://wa.me/?text=${text}`;
  window.open(whatsappUrl, '_blank');
}
```

### Download e Compartilhamento

```typescript
function downloadCard(cardUrl: string, partidaId: string) {
  const link = document.createElement('a');
  link.href = cardUrl;
  link.download = `card-partida-${partidaId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Limpar blob URL após download
  setTimeout(() => {
    URL.revokeObjectURL(cardUrl);
  }, 100);
}
```

## 🔍 Debugging

### Verificar se o card está sendo gerado:

1. **Abrir DevTools** → Network tab
2. **Filtrar por** `/card/partida/`
3. **Verificar:**
   - Status: `200 OK`
   - Content-Type: `image/png`
   - Size: Deve ser alguns KB (não vazio)
   - Headers: Verificar `Cache-Control`

### Logs úteis:

```typescript
console.log('Carregando card para partida:', partidaId);
console.log('URL:', url);
console.log('Response status:', response.status);
console.log('Blob size:', blob.size, 'bytes');
```

## 📊 Performance

### Otimizações recomendadas:

1. **Lazy Loading:** Carregar card apenas quando o usuário clicar em "Ver Card"
2. **Cache Local:** Armazenar blob URL no sessionStorage para evitar requisições repetidas
3. **Preload:** Para cards que o usuário provavelmente vai ver
4. **Compressão:** O servidor já retorna PNG otimizado

### Exemplo de Cache Local:

```typescript
const CARD_CACHE_KEY = `card_${partidaId}`;

// Verificar cache local primeiro
const cachedUrl = sessionStorage.getItem(CARD_CACHE_KEY);
if (cachedUrl) {
  setCardUrl(cachedUrl);
  return;
}

// Carregar do servidor
const blob = await loadCardFromServer();
const url = URL.createObjectURL(blob);
sessionStorage.setItem(CARD_CACHE_KEY, url);
setCardUrl(url);
```

## ✅ Checklist de Implementação

- [ ] Configurar URL base da API
- [ ] Implementar autenticação (Bearer Token)
- [ ] Criar componente/modal para exibir card
- [ ] Implementar loading state
- [ ] Implementar error handling
- [ ] Adicionar botão de download
- [ ] Adicionar botão de abrir em nova aba
- [ ] Adicionar botão de regenerar (opcional)
- [ ] Implementar cleanup de blob URLs
- [ ] Testar com diferentes partidas
- [ ] Testar tratamento de erros (401, 404, 500)
- [ ] Testar cache e refresh

## 📚 Referências

- **API Base:** `https://sua-api.vercel.app/api`
- **Documentação Completa:** Ver `API_DOCUMENTATION.md`
- **Exemplo de Autenticação:** Ver seção de autenticação na documentação da API

## 🆘 Suporte

Em caso de dúvidas ou problemas:
1. Verificar logs do console do navegador
2. Verificar Network tab no DevTools
3. Verificar se o token de autenticação está válido
4. Verificar se a partida existe e tem pelo menos 2 atletas

---

**Última atualização:** 2025-01-XX
**Versão da API:** Compatível com versão atual do backend

