'use client';

import { useActionState } from 'react';

import { Botao, Campo } from '@/components/ui';
import { formatarValor } from '@/lib/dinheiro';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import type { EstadoForm } from '@/server/validacao';

import { apagarDespesa, editarDespesa, marcarParteDespesa, registrarDespesa } from './actions';

export function FormularioDespesa() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(registrarDespesa, {});

  return (
    <form action={acao} className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <Campo
        label="Descrição"
        name="descricao"
        placeholder="Energia"
        erro={estado.campos?.descricao}
      />
      <Campo
        label="Valor"
        name="valor"
        prefixo="R$"
        inputMode="decimal"
        placeholder="200,00"
        erro={estado.campos?.valor}
      />
      <Campo
        label="Vencimento"
        name="vencimentoEm"
        type="date"
        defaultValue={hojeEmSaoPaulo()}
        erro={estado.campos?.vencimentoEm}
      />
      <Botao type="submit" disabled={enviando} className="sm:mt-7 sm:self-start">
        {enviando ? 'Lançando…' : 'Lançar'}
      </Botao>
      <label className="text-navy-700 flex items-center gap-2 text-sm sm:col-span-4 dark:text-white">
        <input
          type="checkbox"
          name="integralEntuloc"
          className="accent-brand-600 size-4 cursor-pointer"
        />
        A EntuLoc paga o valor integral
        <span className="text-navy-400 text-xs">(desmarcado, divide em 3 partes)</span>
      </label>
      {estado.erro && (
        <p className="text-sm text-red-600 sm:col-span-4 dark:text-red-400">{estado.erro}</p>
      )}
    </form>
  );
}

/** Quadradinho da parte: marcar da baixa com a data de hoje, desmarcar desfaz. */
export function MarcarParte({
  id,
  parte,
  rotulo,
  pagaEm,
}: {
  id: string;
  parte: 1 | 2 | 3 | 4;
  rotulo: string;
  pagaEm: string | null;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(marcarParteDespesa, {});
  // Enquanto salva, ja mostra o quadradinho no estado novo.
  const marcada = enviando ? !pagaEm : Boolean(pagaEm);

  return (
    <form action={acao} className="mt-1 text-xs">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="parte" value={parte} />
      <input type="hidden" name="paga" value={pagaEm ? 'nao' : 'sim'} />
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 ${
          pagaEm ? 'text-emerald-700 dark:text-emerald-400' : 'text-navy-400'
        }`}
      >
        <input
          type="checkbox"
          checked={marcada}
          disabled={enviando}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          aria-label={`${rotulo} paga`}
          className="accent-brand-600 size-4 cursor-pointer"
        />
        {pagaEm ? `Paga em ${pagaEm.split('-').reverse().join('/')}` : 'Em aberto'}
      </label>
      {estado.erro && <span className="block text-red-600 dark:text-red-400">{estado.erro}</span>}
    </form>
  );
}

const estiloInput =
  'border-border-subtle bg-surface text-foreground rounded-md border px-2 py-1 text-xs';

/** Corrige a despesa, inclusive trocando entre dividir em 3 e a EntuLoc pagar tudo. */
export function EditarDespesa({
  id,
  descricao,
  valor,
  vencimentoEm,
  integralEntuloc,
  algumaPaga,
}: {
  id: string;
  descricao: string;
  valor: number;
  vencimentoEm: string;
  integralEntuloc: boolean;
  algumaPaga: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(editarDespesa, {});

  return (
    <details className="text-xs">
      <summary className="text-brand-600 cursor-pointer font-medium">Editar</summary>
      <form action={acao} className="mt-2 flex w-56 flex-col gap-1.5">
        <input type="hidden" name="id" value={id} />
        <label className="text-navy-500 flex flex-col gap-1">
          Descrição
          <input name="descricao" defaultValue={descricao} className={estiloInput} />
        </label>
        <label className="text-navy-500 flex items-center justify-between gap-2">
          Valor R$
          <input
            name="valor"
            defaultValue={formatarValor(valor)}
            inputMode="decimal"
            className={`${estiloInput} w-28`}
          />
        </label>
        <label className="text-navy-500 flex items-center justify-between gap-2">
          Vencimento
          <input
            type="date"
            name="vencimentoEm"
            defaultValue={vencimentoEm}
            className={`${estiloInput} w-28`}
          />
        </label>
        <label className="text-navy-700 flex items-center gap-2 dark:text-white">
          <input
            type="checkbox"
            name="integralEntuloc"
            defaultChecked={integralEntuloc}
            className="accent-brand-600 size-4 cursor-pointer"
          />
          A EntuLoc paga o valor integral
        </label>
        {algumaPaga && (
          <span className="text-navy-400">
            Com parte paga, só descrição e vencimento mudam. Para mudar valor ou divisão, desmarque
            as partes pagas.
          </span>
        )}
        <Botao type="submit" disabled={enviando} className="px-3 py-1 text-xs">
          {enviando ? 'Salvando…' : 'Salvar'}
        </Botao>
        {estado.ok && <span className="text-emerald-700 dark:text-emerald-300">Salvo.</span>}
        {(estado.erro || estado.campos) && (
          <span className="text-red-600 dark:text-red-400">
            {estado.erro ?? Object.values(estado.campos ?? {})[0]}
          </span>
        )}
      </form>
    </details>
  );
}

/** Em duas etapas para nao apagar num toque sem querer. */
export function ApagarDespesa({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(apagarDespesa, {});

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-red-600 dark:text-red-400">
        Apagar
      </summary>
      <form action={acao} className="mt-2 flex flex-col gap-1">
        <input type="hidden" name="id" value={id} />
        <Botao type="submit" variante="perigo" disabled={enviando} className="px-3 py-1 text-xs">
          {enviando ? 'Apagando…' : 'Apagar de vez'}
        </Botao>
        {estado.erro && <span className="text-red-600 dark:text-red-400">{estado.erro}</span>}
      </form>
    </details>
  );
}
