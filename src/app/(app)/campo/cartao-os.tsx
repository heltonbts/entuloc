import Link from 'next/link';

import { Etiqueta } from '@/components/ui';

import { linkMapa, type OsCampo } from './consulta';

export const rotuloEtapa = {
  entrega: { texto: 'Entregar', tom: 'marca' },
  retirada: { texto: 'Retirar', tom: 'alerta' },
  baixa: { texto: 'Dar baixa', tom: 'neutro' },
} as const;

export function CartaoOs({ os, mostrarMotorista }: { os: OsCampo; mostrarMotorista: boolean }) {
  const etapa = rotuloEtapa[os.etapa!];
  return (
    <article className="border-border-subtle bg-surface flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-navy-400 text-xs font-semibold">OS Nº {os.numeroOs}</p>
          <p className="text-navy-700 text-lg font-bold dark:text-white">{os.cliente}</p>
        </div>
        <Etiqueta tom={etapa.tom}>{etapa.texto}</Etiqueta>
      </div>

      <div className="text-navy-600 dark:text-navy-100 text-sm">
        <p>
          {os.endereco} — {os.cidade}/{os.uf}
        </p>
        <p className="text-navy-400 mt-1 text-xs">
          Caçamba {os.numeracao} · {os.tipo}
          {mostrarMotorista && ` · ${os.motorista ?? 'sem motorista'}`}
        </p>
        {os.observacoes && <p className="mt-1 text-xs">Obs.: {os.observacoes}</p>}
        {os.status === 'retirada_solicitada' && (
          <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Cliente pediu a retirada
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm font-medium">
        {os.etapa !== 'baixa' && (
          <a
            href={linkMapa(os)}
            target="_blank"
            rel="noreferrer"
            className="border-border-subtle text-navy-700 rounded-lg border px-3 py-2.5 text-center dark:text-white"
          >
            Abrir no mapa
          </a>
        )}
        {os.telefone && os.etapa !== 'baixa' && (
          <a
            href={`tel:${os.telefone.replace(/\D/g, '')}`}
            className="border-border-subtle text-navy-700 rounded-lg border px-3 py-2.5 text-center dark:text-white"
          >
            Ligar
          </a>
        )}
        <Link
          href={`/campo/${os.id}`}
          className="bg-brand-600 hover:bg-brand-700 col-span-2 rounded-lg px-3 py-3 text-center font-semibold text-white"
        >
          {etapa.texto} — tirar foto
        </Link>
      </div>
    </article>
  );
}
