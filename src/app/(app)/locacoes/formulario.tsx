'use client';

import { useActionState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import { formatarBRL } from '@/lib/dinheiro';
import type { EstadoForm } from '@/server/validacao';

import { concluirLocacao, criarLocacao, registrarEntrega, solicitarRetirada } from './actions';

const hoje = () => new Date().toISOString().slice(0, 10);

type Opcao = { id: string; rotulo: string };

export function FormularioLocacao({
  clientes,
  cacambas,
  cidades,
  regras,
}: {
  clientes: Opcao[];
  cacambas: Opcao[];
  cidades: Opcao[];
  regras: Opcao[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarLocacao, {});

  if (cacambas.length === 0 || clientes.length === 0 || cidades.length === 0) {
    return (
      <p className="text-navy-500 dark:text-navy-200 text-sm">
        Para abrir uma locação é preciso ter ao menos um cliente, uma caçamba disponível e uma
        cidade atendida.
      </p>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Cliente" name="clienteId">
          {clientes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
        <Select label="Caçamba disponível" name="cacambaId">
          {cacambas.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
        <Select label="Cidade" name="cidadeId">
          {cidades.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Campo
          label="Endereço de entrega"
          name="enderecoEntrega"
          erro={estado.campos?.enderecoEntrega}
        />
        <Select label="Regra de multa" name="regraMultaId">
          <option value="">Sem multa</option>
          {regras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Abrindo…' : 'Abrir locação'}
        </Botao>
        {estado.erro && (
          <span className="text-sm text-red-600 dark:text-red-400">{estado.erro}</span>
        )}
      </div>
    </form>
  );
}

function AcaoComData({
  acaoServidor,
  id,
  campo,
  rotulo,
}: {
  acaoServidor: (estado: EstadoForm, form: FormData) => Promise<EstadoForm>;
  id: string;
  campo: string;
  rotulo: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(acaoServidor, {});

  return (
    <form action={acao} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          type="date"
          name={campo}
          defaultValue={hoje()}
          aria-label={rotulo}
          className="border-border-subtle bg-surface text-foreground rounded-md border px-2 py-1 text-xs"
        />
        <Botao type="submit" disabled={enviando} className="px-3 py-1 text-xs whitespace-nowrap">
          {rotulo}
        </Botao>
      </div>
      {estado.erro && <span className="text-xs text-red-600 dark:text-red-400">{estado.erro}</span>}
    </form>
  );
}

export function AcoesLocacao({
  id,
  status,
  podeFechar,
}: {
  id: string;
  status: string;
  podeFechar: boolean;
}) {
  if (status === 'agendada') {
    return (
      <AcaoComData acaoServidor={registrarEntrega} id={id} campo="entregaEm" rotulo="Entregar" />
    );
  }
  if (status === 'entregue') {
    return (
      <AcaoComData acaoServidor={solicitarRetirada} id={id} campo="em" rotulo="Pedir retirada" />
    );
  }
  if (status === 'retirada_solicitada' && podeFechar) {
    return (
      <AcaoComData acaoServidor={concluirLocacao} id={id} campo="retiradaEm" rotulo="Concluir" />
    );
  }
  if (status === 'retirada_solicitada') {
    return <span className="text-navy-400 text-xs">Aguardando fechamento pelo gestor</span>;
  }
  return <span className="text-navy-400 text-xs">—</span>;
}

export { formatarBRL };
