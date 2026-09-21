'use client';

import { useActionState, useState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';

import { criarUsuario, redefinirSenha, trocarPapel, type EstadoSenha } from './actions';

/** A senha provisoria aparece so aqui, uma vez: nao fica salva em lugar nenhum. */
function SenhaGerada({ estado }: { estado: EstadoSenha }) {
  const [copiada, setCopiada] = useState(false);
  if (!estado.senha) return null;
  const senha = estado.senha;

  return (
    <div
      role="status"
      className="rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
    >
      <p>
        Senha provisória de <strong>{estado.para}</strong>:
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-3">
        <code className="bg-surface rounded px-2 py-1 font-mono text-base tracking-wider">
          {senha}
        </code>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(senha).then(() => setCopiada(true))}
          className="text-xs font-semibold underline underline-offset-2"
        >
          {copiada ? 'Copiada' : 'Copiar'}
        </button>
      </p>
      <p className="mt-2 text-xs">
        Repasse agora — ela não será mostrada de novo. No primeiro acesso a pessoa cria a senha
        dela.
      </p>
    </div>
  );
}

export function FormularioUsuario() {
  const [estado, acao, enviando] = useActionState<EstadoSenha, FormData>(criarUsuario, {});

  return (
    <div className="flex flex-col gap-4">
      <form action={acao} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          <Campo label="Nome" name="nome" erro={estado.campos?.nome} />
          <Campo label="E-mail (login)" name="email" type="email" erro={estado.campos?.email} />
          <Select label="Papel" name="papel" defaultValue="funcionario">
            <option value="funcionario">Funcionário</option>
            <option value="gestor">Gestor</option>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Botao type="submit" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar usuário'}
          </Botao>
          {estado.erro && (
            <span className="text-sm text-red-600 dark:text-red-400">{estado.erro}</span>
          )}
        </div>
      </form>
      <SenhaGerada estado={estado} />
    </div>
  );
}

export function RedefinirSenha({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState<EstadoSenha, FormData>(redefinirSenha, {});

  return (
    <div className="flex flex-col gap-2">
      <form action={acao}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={enviando}
          className="text-navy-500 hover:text-brand-600 dark:text-navy-200 text-xs font-medium whitespace-nowrap underline underline-offset-2 disabled:opacity-50"
        >
          {enviando ? 'Gerando…' : 'Redefinir senha'}
        </button>
      </form>
      {estado.erro && <span className="text-xs text-red-600 dark:text-red-400">{estado.erro}</span>}
      <SenhaGerada estado={estado} />
    </div>
  );
}

export function SeletorPapel({ id, papel }: { id: string; papel: 'gestor' | 'funcionario' }) {
  return (
    <form action={trocarPapel}>
      <input type="hidden" name="id" value={id} />
      <select
        name="valor"
        defaultValue={papel}
        aria-label="Papel"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border-border-subtle bg-surface text-foreground rounded-md border px-2 py-1 text-xs"
      >
        <option value="funcionario">Funcionário</option>
        <option value="gestor">Gestor</option>
      </select>
    </form>
  );
}
