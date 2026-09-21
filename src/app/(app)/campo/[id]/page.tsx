import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { rotuloEtapa } from '../cartao-os';
import { linkMapa, osDeCampo } from '../consulta';
import { RegistroEtapa } from './registro';

export const metadata = { title: 'Registrar etapa' };
export const dynamic = 'force-dynamic';

export default async function PaginaRegistroCampo({ params }: PageProps<'/campo/[id]'>) {
  const usuario = await exigirPermissaoPagina('coletas.registrar');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // Mesma consulta da lista: se a OS nao e do motorista ou ja nao tem etapa
  // pendente, nao aparece aqui.
  const [os] = await osDeCampo(usuario, { id });
  if (!os?.etapa) notFound();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link
        href="/campo"
        className="text-navy-500 hover:text-brand-600 text-sm font-medium underline underline-offset-2"
      >
        ← Voltar
      </Link>

      <div>
        <p className="text-navy-400 text-xs font-semibold">
          OS Nº {os.numeroOs} · {rotuloEtapa[os.etapa].texto}
        </p>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          {os.cliente}
        </h1>
        <a
          href={linkMapa(os)}
          target="_blank"
          rel="noreferrer"
          className="text-brand-600 mt-1 block text-sm underline underline-offset-2"
        >
          {os.endereco} — {os.cidade}/{os.uf}
        </a>
        <p className="text-navy-400 mt-1 text-xs">
          Caçamba {os.numeracao} · {os.tipo}
        </p>
        {os.observacoes && (
          <p className="text-navy-600 dark:text-navy-100 mt-2 text-sm">Obs.: {os.observacoes}</p>
        )}
      </div>

      <RegistroEtapa id={os.id} etapa={os.etapa} />
    </div>
  );
}
