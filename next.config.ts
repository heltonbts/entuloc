import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fotos de campo: o celular reduz para ~500 KB, mas camera sem suporte a
      // reducao manda a original. 5 MB cobre a trava de 4 MB do servidor + multipart.
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
