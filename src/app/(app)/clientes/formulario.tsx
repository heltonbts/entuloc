'use client';

import { useActionState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import type { EstadoForm } from '@/server/validacao';

import { criarCliente } from './actions';

export function FormularioCliente() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarCliente, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Campo label="Nome ou razão social" name="nome" erro={estado.campos?.nome} />
        <Select label="Tipo" name="tipoPessoa" defaultValue="fisica">
          <option value="fisica">Pessoa física</option>
          <option value="juridica">Pessoa jurídica</option>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          label="CPF / CNPJ"
          name="documento"
          placeholder="opcional"
          dica="Validado por dígito"
          erro={estado.campos?.documento}
        />
        <Campo label="Telefone" name="telefone" placeholder="opcional" />
        <Campo
          label="E-mail"
          name="email"
          type="email"
          placeholder="opcional"
          erro={estado.campos?.email}
        />
      </div>
      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Cadastrar cliente'}
        </Botao>
        {estado.erro && (
          <span className="text-sm text-red-600 dark:text-red-400">{estado.erro}</span>
        )}
      </div>
    </form>
  );
}
