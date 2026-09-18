import Link from 'next/link';

import { Logo } from '@/components/brand/logo';

const navegacao = [
  { href: '/painel', rotulo: 'Painel' },
  { href: '/cadastros/tipos', rotulo: 'Tipos de caçamba' },
  { href: '/cadastros/frota', rotulo: 'Frota' },
  { href: '/cadastros/cidades', rotulo: 'Cidades e frete' },
  { href: '/cadastros/multas', rotulo: 'Regras de multa' },
];

export default function LayoutApp({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-border-subtle bg-surface sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/painel" className="focus-visible:outline-brand-600 rounded">
            <Logo size="sm" />
          </Link>
          <span className="text-navy-400 text-xs">Gestor</span>
        </div>
        <nav className="border-border-subtle border-t">
          <ul className="text-navy-500 dark:text-navy-200 mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 text-sm">
            {navegacao.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="hover:text-brand-600 hover:border-brand-500 focus-visible:outline-brand-600 block border-b-2 border-transparent px-3 py-3 font-medium whitespace-nowrap transition-colors"
                >
                  {item.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
