'use client';

import { useActionState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import { formatarValor } from '@/lib/dinheiro';
import type { EstadoForm } from '@/server/validacao';

import { salvarTipo } from './actions';

type Props = {
  id: string;
  nome: string;
  volumeM3: string;
  valorLocacao: number;
  diasInclusos: number;
  contagemPrazo: 'uteis' | 'corridos';
};

export function FormularioTipo({ id, nome, volumeM3, ...inicial }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarTipo, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-navy-700 text-lg font-bold dark:text-white">{nome}</h3>
        <span className="text-navy-400 text-sm">{Number(volumeM3)} m³</span>
      </div>

      <input type="hidden" name="id" value={id} />

      <Campo
        label="Valor da locação"
        name="valorLocacao"
        prefixo="R$"
        inputMode="decimal"
        defaultValue={formatarValor(inicial.valorLocacao)}
        erro={estado.campos?.valorLocacao}
        dica={inicial.valorLocacao === 0 ? 'Ainda não definido' : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Dias inclusos"
          name="diasInclusos"
          type="number"
          min={1}
          defaultValue={inicial.diasInclusos}
          erro={estado.campos?.diasInclusos}
        />
        <Select label="Contagem" name="contagemPrazo" defaultValue={inicial.contagemPrazo}>
          <option value="uteis">Dias úteis</option>
          <option value="corridos">Dias corridos</option>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar'}
        </Botao>
        {estado.ok && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Salvo.</span>
        )}
      </div>
    </form>
  );
}
