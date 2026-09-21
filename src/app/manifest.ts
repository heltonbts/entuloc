import type { MetadataRoute } from 'next';

/** Instalavel na tela inicial do celular do motorista, abrindo direto nas OS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EntuLoc — Minhas OS',
    short_name: 'EntuLoc',
    description: 'Entregas, trocas e retiradas de caçambas.',
    start_url: '/campo',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#fd7100',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
