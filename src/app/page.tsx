import Image from 'next/image';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';

const modulos = [
  {
    titulo: 'Caçambas',
    descricao: 'Frota, tamanhos, status de cada caçamba e onde ela está agora.',
    href: '#',
  },
  {
    titulo: 'Locações',
    descricao: 'Pedidos de locação, prazos, prorrogações e devoluções.',
    href: '#',
  },
  {
    titulo: 'Coletas',
    descricao: 'Roteiro do dia, motoristas e comprovantes de retirada.',
    href: '#',
  },
  {
    titulo: 'Clientes',
    descricao: 'Construtoras, condomínios e pessoa física, com histórico e endereços.',
    href: '#',
  },
  {
    titulo: 'Destinação',
    descricao: 'Triagem, reciclagem e MTR — rastreio do entulho até o destino final.',
    href: '#',
  },
  {
    titulo: 'Financeiro',
    descricao: 'Faturamento das locações, venda de material reciclado e recebimentos.',
    href: '#',
  },
];

export default function Home() {
  return (
    <>
      <header className="border-border-subtle bg-surface sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo size="sm" />
          <Link
            href="#"
            className="bg-brand-500 hover:bg-brand-400 focus-visible:outline-brand-600 text-navy-900 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14">
        <section className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-brand-600 font-display text-xs font-bold tracking-[0.2em] uppercase">
              Sistema de gestão
            </p>
            <h1 className="font-display text-navy-700 mt-3 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl dark:text-white">
              Toda a operação de entulho em um lugar só
            </h1>
            <p className="text-navy-500 dark:text-navy-200 mt-4 max-w-xl text-lg text-pretty">
              Da solicitação da caçamba até a destinação final do material: locações, roteiro de
              coleta, clientes, reciclagem e faturamento da EntuLoc.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#"
                className="bg-brand-500 hover:bg-brand-400 focus-visible:outline-brand-600 text-navy-900 rounded-md px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Acessar o painel
              </Link>
              <Link
                href="#"
                className="border-navy-200 text-navy-700 hover:bg-navy-50 dark:border-navy-600 dark:hover:bg-navy-800 rounded-md border px-5 py-3 text-sm font-semibold transition-colors dark:text-white"
              >
                Solicitar caçamba
              </Link>
            </div>
          </div>

          <div className="bg-brand-500 relative overflow-hidden rounded-2xl p-8 shadow-lg">
            <Image
              src="/brand/entuloc-logo.jpeg"
              alt="Caçamba EntuLoc"
              width={640}
              height={640}
              className="h-auto w-full rounded-xl"
              priority
            />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-navy-700 text-sm font-bold tracking-[0.18em] uppercase dark:text-white">
            Módulos
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((modulo) => (
              <li key={modulo.titulo}>
                <Link
                  href={modulo.href}
                  className="border-border-subtle bg-surface hover:border-brand-400 focus-visible:outline-brand-600 block h-full rounded-xl border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span className="bg-brand-500 block h-1 w-8 rounded-full" />
                  <h3 className="font-display text-navy-700 mt-4 text-lg font-bold dark:text-white">
                    {modulo.titulo}
                  </h3>
                  <p className="text-navy-500 dark:text-navy-200 mt-1.5 text-sm text-pretty">
                    {modulo.descricao}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-border-subtle bg-surface border-t">
        <div className="text-navy-500 dark:text-navy-200 mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Logo size="sm" showTagline />
          <p>© {new Date().getFullYear()} EntuLoc. Todos os direitos reservados.</p>
        </div>
      </footer>
    </>
  );
}
