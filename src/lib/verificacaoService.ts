// lib/verificacaoService.ts - Serviço compartilhado para códigos de verificação
// Em produção, isso deve ser substituído por Redis ou banco de dados

interface CodigoVerificacao {
  codigo: string;
  expiraEm: number;
}

// Armazenar códigos temporariamente (em produção, usar Redis)
const codigosVerificacao = new Map<string, CodigoVerificacao>();

// Limpar códigos expirados periodicamente
setInterval(() => {
  const agora = Date.now();
  for (const [key, value] of codigosVerificacao.entries()) {
    if (value.expiraEm < agora) {
      codigosVerificacao.delete(key);
    }
  }
}, 60000); // Limpar a cada minuto

export function gerarCodigoVerificacao(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function armazenarCodigoVerificacao(telefone: string, codigo: string, expiraEm: number): void {
  const telefoneNormalizado = telefone.replace(/\D/g, '');
  codigosVerificacao.set(telefoneNormalizado, { codigo, expiraEm });
}

export function obterCodigoVerificacao(telefone: string): CodigoVerificacao | null {
  const telefoneNormalizado = telefone.replace(/\D/g, '');
  const dados = codigosVerificacao.get(telefoneNormalizado);
  
  if (!dados) {
    return null;
  }
  
  if (dados.expiraEm < Date.now()) {
    codigosVerificacao.delete(telefoneNormalizado);
    return null;
  }
  
  return dados;
}

export function removerCodigoVerificacao(telefone: string): void {
  const telefoneNormalizado = telefone.replace(/\D/g, '');
  codigosVerificacao.delete(telefoneNormalizado);
}

