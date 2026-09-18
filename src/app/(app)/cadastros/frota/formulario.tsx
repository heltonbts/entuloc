'use client';

import { useActionState, useEffect, useRef } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import type { EstadoForm } from '@/server/validacao';

import { criarCacamba, mudarStatus } from './actions';

export const ROTULO_STATUS = {
  disponivel: 'Disponível',
  alugada: 'Alugada',
  aguardando_retirada: 'Aguardando retirada',
  manutencao: 'Manutenção',
  inativa: 'Inativa',
} as const;

export type StatusCacamba = keyof typeof ROTULO_STATUS;

export function FormularioCacamba({ tipos }: { tipos: { id: string; nome: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarCacamba, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={acao} className="grid gap-4 sm:grid-cols-[1fr_1.5fr_2fr_auto]">
      <Campo
        label="Numeração"
        name="numeracao"
        placeholder="042"
        dica="Número pintado na unidade"
        erro={estado.campos?.numeracao}
      />
      <Select label="Tipo" name="tipoId">
        {tipos.map((tipo) => (
          <option key={tipo.id} value={tipo.id}>
            {tipo.nome}
          </option>
        ))}
      </Select>
      <Campo label="Observações" name="observacoes" placeholder="opcional" />
      <Botao type="submit" disabled={enviando} className="sm:mt-7 sm:self-start">
        {enviando ? 'Salvando…' : 'Adicionar'}
      </Botao>
      {estado.erro && (
        <p className="text-sm text-red-600 sm:col-span-4 dark:text-red-400">{estado.erro}</p>
      )}
    </form>
  );
}

export function SeletorStatus({ id, status }: { id: string; status: StatusCacamba }) {
  const [, acao, enviando] = useActionState<EstadoForm, FormData>(mudarStatus, {});

  return (
    <form action={acao} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        disabled={enviando}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Situação da caçamba"
        className="border-border-subtle bg-surface text-foreground focus:border-brand-500 rounded-md border px-2 py-1 text-sm focus:outline-none"
      >
        {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>
    </form>
  );
}
