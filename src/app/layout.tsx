import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'EntuLoc — Coleta e Reciclagem de Entulho',
    template: '%s | EntuLoc',
  },
  description:
    'Sistema de gestao da EntuLoc: locacao de cacambas, coletas, clientes, destinacao e venda de entulho reciclado.',
  applicationName: 'EntuLoc',
  keywords: ['cacamba', 'entulho', 'coleta', 'reciclagem', 'locacao de cacamba'],
  openGraph: {
    title: 'EntuLoc — Coleta e Reciclagem de Entulho',
    description: 'Locacao de cacambas, coleta e reciclagem de entulho.',
    siteName: 'EntuLoc',
    locale: 'pt_BR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#fd7100',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
