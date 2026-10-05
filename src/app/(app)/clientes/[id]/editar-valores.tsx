'use client';

import { useActionState } from 'react';

import { Botao } from '@/components/ui';
import { formatarBRL, formatarValor } from '@/lib/dinheiro';
import type { EstadoForm } from '@/server/validacao';

import { alterarValores } from '../../locacoes/actions';

const estiloInput =
  'border-border-subtle bg-surface text-foreground w-24 rounded-md border px-2 py-1 text-xs';

/** Total da locacao; enquanto ela esta em andamento, abre para corrigir valor e frete. */
export function TotalEditavel({
  id,
  total,
  valorLocacao,
  valorFrete,
  editavel,
}: {
  id: string;
  total: number;
  valorLocacao: number;
  valorFrete: number;
  editavel: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(alterarValores, {});

  if (!editavel) return <>{formatarBRL(total)}</>;

  return (
    <details>
      <summary className="cursor-pointer">
        {formatarBRL(total)}{' '}
        <span className="text-brand-600 text-xs font-medium underline underline-offset-2">
          editar
        </span>
      </summary>
      <form action={acao} className="mt-2 flex flex-col gap-1 text-xs">
        <input type="hidden" name="id" value={id} />
        <label className="text-navy-500 flex items-center justify-between gap-2">
          Locação R$
          <input
            name="valorLocacao"
            defaultValue={formatarValor(valorLocacao)}
            inputMode="decimal"
            className={estiloInput}
          />
        </label>
        <label className="text-navy-500 flex items-center justify-between gap-2">
          Frete R$
          <input
            name="valorFrete"
            defaultValue={formatarValor(valorFrete)}
            inputMode="decimal"
            className={estiloInput}
          />
        </label>
        <Botao type="submit" disabled={enviando} className="px-3 py-1 text-xs">
          {enviando ? 'Salvando…' : 'Salvar valor'}
        </Botao>
        {estado.ok && <span className="text-emerald-700 dark:text-emerald-300">Salvo.</span>}
        {(estado.erro || estado.campos) && (
          <span className="max-w-48 text-red-600 dark:text-red-400">
            {estado.erro ?? Object.values(estado.campos ?? {})[0]}
          </span>
        )}
      </form>
    </details>
  );
}
