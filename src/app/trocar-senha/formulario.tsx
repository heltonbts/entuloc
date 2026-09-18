'use client';

import { useActionState } from 'react';

import { Botao, Campo } from '@/components/ui';
import { trocarSenha } from '@/server/auth/actions';
import type { EstadoForm } from '@/server/validacao';

export function FormularioTrocaSenha() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(trocarSenha, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        label="Senha atual"
        name="senhaAtual"
        type="password"
        autoComplete="current-password"
        erro={estado.campos?.senhaAtual}
      />
      <Campo
        label="Nova senha"
        name="novaSenha"
        type="password"
        autoComplete="new-password"
        dica="Mínimo de 8 caracteres"
        erro={estado.campos?.novaSenha}
      />
      <Campo
        label="Confirme a nova senha"
        name="confirmacao"
        type="password"
        autoComplete="new-password"
        erro={estado.campos?.confirmacao}
      />
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.erro}
        </p>
      )}
      <Botao type="submit" disabled={enviando} className="mt-2 w-full py-2.5">
        {enviando ? 'Salvando…' : 'Trocar senha'}
      </Botao>
    </form>
  );
}
