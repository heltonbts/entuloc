import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Logo } from '@/components/brand/logo';
import { podeAcessar, type Permissao } from '@/lib/dominio/tipos';
import { sair } from '@/server/auth/actions';
import { exigirSessao } from '@/server/auth/guarda';

const navegacao: { href: string; rotulo: string; exige?: Permissao }[] = [
  { href: '/painel', rotulo: 'Painel' },
  { href: '/cadastros/tipos', rotulo: 'Tipos de caçamba', exige: 'precos.editar' },
  { href: '/cadastros/frota', rotulo: 'Frota', exige: 'frota.editar' },
  { href: '/cadastros/cidades', rotulo: 'Cidades e frete', exige: 'cidades.editar' },
  { href: '/cadastros/multas', rotulo: 'Regras de multa', exige: 'multas.editar' },
];

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  const usuario = await exigirSessao();

  // Quem ainda nao definiu senha propria nao circula pelo sistema.
  if (usuario.precisaTrocarSenha) redirect('/trocar-senha');

  const itens = navegacao.filter((i) => !i.exige || podeAcessar(usuario.papel, i.exige));

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-border-subtle bg-surface sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/painel" className="focus-visible:outline-brand-600 rounded">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-right sm:block">
              <span className="text-navy-700 block text-sm font-medium dark:text-white">
                {usuario.nome}
              </span>
              <span className="text-navy-400 block text-xs capitalize">{usuario.papel}</span>
            </span>
            <form action={sair}>
              <button
                type="submit"
                className="text-navy-500 hover:text-brand-600 dark:text-navy-200 focus-visible:outline-brand-600 rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav className="border-border-subtle border-t">
          <ul className="text-navy-500 dark:text-navy-200 mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 text-sm">
            {itens.map((item) => (
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
