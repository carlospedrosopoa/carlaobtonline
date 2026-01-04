/** @type {import('next').NextConfig} */
const nextConfig = {
  // Forçar SSR para todas as rotas (desabilita SSG)
  // Isso garante que os dados sejam sempre buscados no servidor a cada requisição
  output: 'standalone',
  
  // Desabilitar cache de imagens estáticas se necessário
  images: {
    unoptimized: false,
  },
  
  // Configurações experimentais se necessário
  experimental: {
    // Forçar renderização no servidor
  },
}

module.exports = nextConfig

