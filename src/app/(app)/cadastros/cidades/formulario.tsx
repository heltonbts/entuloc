'use client';

import { useActionState, useEffect, useRef } from 'react';

import { Botao, Campo } from '@/components/ui';
import type { EstadoForm } from '@/server/validacao';

import { criarCidade } from './actions';

export function FormularioCidade() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarCidade, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={acao} className="grid gap-4 sm:grid-cols-[2fr_auto_1fr_auto]">
      <Campo
        label="Cidade"
        name="nome"
        placeholder="Juazeiro do Norte"
        erro={estado.campos?.nome}
      />
      <Campo
        label="UF"
        name="uf"
        placeholder="CE"
        maxLength={2}
        className="uppercase sm:w-20"
        erro={estado.campos?.uf}
      />
      <Campo
        label="Frete"
        name="valorFrete"
        placeholder="120,00"
        prefixo="R$"
        inputMode="decimal"
        erro={estado.campos?.valorFrete}
      />
      <Botao type="submit" disabled={enviando} className="sm:mt-7">
        {enviando ? 'Salvando…' : 'Adicionar'}
      </Botao>
      {estado.erro && (
        <p className="text-sm text-red-600 sm:col-span-4 dark:text-red-400">{estado.erro}</p>
      )}
    </form>
  );
}
