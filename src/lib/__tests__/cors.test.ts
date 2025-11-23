// Testes para garantir que CORS não afeta requisições do mesmo domínio
// Este arquivo demonstra o comportamento esperado

import { getCorsHeaders } from '../cors';

describe('CORS - Garantia de não afetar requisições do mesmo domínio', () => {
  
  // Simular variável de ambiente
  const originalEnv = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    // Limpar variável de ambiente antes de cada teste
    delete process.env.ALLOWED_ORIGINS;
  });

  afterEach(() => {
    // Restaurar variável de ambiente original
    if (originalEnv) {
      process.env.ALLOWED_ORIGINS = originalEnv;
    }
  });

  test('Requisição do mesmo domínio (sem Origin) não recebe headers CORS', () => {
    // Quando não há header Origin (requisição do mesmo domínio)
    const headers = getCorsHeaders(null);
    
    // Deve retornar objeto vazio = nenhum header CORS
    expect(headers).toEqual({});
    expect(Object.keys(headers).length).toBe(0);
  });

  test('Requisição do mesmo domínio (undefined) não recebe headers CORS', () => {
    const headers = getCorsHeaders(undefined as any);
    
    expect(headers).toEqual({});
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  test('Requisição cross-origin SEM configuração não recebe headers CORS', () => {
    // Sem ALLOWED_ORIGINS configurado e em produção
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;
    
    const headers = getCorsHeaders('https://parceiro.com');
    
    // Deve retornar vazio porque não está na lista permitida
    expect(headers).toEqual({});
  });

  test('Requisição cross-origin COM configuração recebe headers CORS', () => {
    // Com ALLOWED_ORIGINS configurado
    process.env.ALLOWED_ORIGINS = 'https://parceiro.com,https://outro.com';
    
    const headers = getCorsHeaders('https://parceiro.com');
    
    // Deve ter headers CORS
    expect(headers['Access-Control-Allow-Origin']).toBe('https://parceiro.com');
    expect(headers['Access-Control-Allow-Methods']).toBeDefined();
    expect(headers['Access-Control-Allow-Headers']).toBeDefined();
  });

  test('Requisição cross-origin NÃO permitida não recebe headers CORS', () => {
    process.env.ALLOWED_ORIGINS = 'https://parceiro.com';
    
    const headers = getCorsHeaders('https://nao-permitido.com');
    
    // Deve retornar vazio porque não está na lista
    expect(headers).toEqual({});
  });

  test('Em desenvolvimento, localhost é permitido automaticamente', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOWED_ORIGINS;
    
    const headers = getCorsHeaders('http://localhost:3000');
    
    // Deve ter headers CORS em desenvolvimento
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });
});

