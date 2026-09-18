'use client';

import { useActionState } from 'react';

import { Botao, Campo } from '@/components/ui';
import { entrar } from '@/server/auth/actions';
import type { EstadoForm } from '@/server/validacao';

export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(entrar, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        label="E-mail"
        name="email"
        type="email"
        autoComplete="username"
        autoFocus
        erro={estado.campos?.email}
      />
      <Campo
        label="Senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        erro={estado.campos?.senha}
      />
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.erro}
        </p>
      )}
      <Botao type="submit" disabled={enviando} className="mt-2 w-full py-2.5">
        {enviando ? 'Entrando…' : 'Entrar'}
      </Botao>
    </form>
  );
}
