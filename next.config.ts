import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Sempre busca o service worker novo: senao uma versao velha fica
        // presa nos celulares servindo tela antiga.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Fotos de campo: o celular reduz para ~500 KB, mas camera sem suporte a
      // reducao manda a original. 5 MB cobre a trava de 4 MB do servidor + multipart.
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
