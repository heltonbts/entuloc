'use client';

import { useActionState, useState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import { formatarBRL, formatarValor } from '@/lib/dinheiro';
import type { EstadoForm } from '@/server/validacao';

import {
  cancelarLocacao,
  concluirLocacao,
  criarLocacao,
  registrarEntrega,
  solicitarRetirada,
  trocarMotorista,
} from './actions';

const hoje = () => new Date().toISOString().slice(0, 10);

type Opcao = { id: string; rotulo: string };

export type OpcaoCliente = Opcao & { endereco: string; cidade: string; uf: string };
export type OpcaoCidade = Opcao & { nome: string; uf: string; frete: number };

/** Compara nomes de cidade ignorando acento e maiusculas ("Sao Jose" = "São José"). */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function cidadeDoCliente(cliente: OpcaoCliente | undefined, cidades: OpcaoCidade[]) {
  if (!cliente) return undefined;
  return cidades.find(
    (c) => normalizar(c.nome) === normalizar(cliente.cidade) && c.uf === cliente.uf.toUpperCase(),
  );
}

export function FormularioLocacao({
  clientes,
  cacambas,
  cidades,
  regras,
  motoristas,
}: {
  clientes: OpcaoCliente[];
  cacambas: Opcao[];
  cidades: OpcaoCidade[];
  regras: Opcao[];
  motoristas: Opcao[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarLocacao, {});

  const inicial = cidadeDoCliente(clientes[0], cidades) ?? cidades[0];
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '');
  const [cidadeId, setCidadeId] = useState(inicial?.id ?? '');
  const [frete, setFrete] = useState(inicial ? formatarValor(inicial.frete) : '');

  if (cacambas.length === 0 || clientes.length === 0 || cidades.length === 0) {
    return (
      <p className="text-navy-500 dark:text-navy-200 text-sm">
        Para abrir uma locação é preciso ter ao menos um cliente, uma caçamba disponível e uma
        cidade atendida.
      </p>
    );
  }

  const cliente = clientes.find((c) => c.id === clienteId);

  function escolherCidade(id: string) {
    setCidadeId(id);
    const cidade = cidades.find((c) => c.id === id);
    if (cidade) setFrete(formatarValor(cidade.frete));
  }

  function escolherCliente(id: string) {
    setClienteId(id);
    const cidade = cidadeDoCliente(
      clientes.find((c) => c.id === id),
      cidades,
    );
    if (cidade) escolherCidade(cidade.id);
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Cliente"
          name="clienteId"
          value={clienteId}
          onChange={(e) => escolherCliente(e.target.value)}
        >
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
      </div>
      <Campo
        label="Endereço da caçamba"
        name="enderecoEntrega"
        placeholder={cliente?.endereco ?? 'Rua, número, bairro'}
        dica="Deixe em branco para entregar no endereço do cadastro. Preencha só se for diferente."
        erro={estado.campos?.enderecoEntrega}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Cidade da entrega"
          name="cidadeId"
          value={cidadeId}
          onChange={(e) => escolherCidade(e.target.value)}
        >
          {cidades.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
        <Campo
          label="Frete"
          name="valorFrete"
          prefixo="R$"
          inputMode="decimal"
          value={frete}
          onChange={(e) => setFrete(e.target.value)}
          dica="Vem da tabela da cidade; ajuste se precisar."
          erro={estado.campos?.valorFrete}
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
      <Select label="Motorista" name="motoristaId">
        {motoristas.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </Select>
      <Campo
        label="Observações para a equipe"
        name="observacoes"
        placeholder="opcional — ponto de referência, onde posicionar a caçamba"
        dica="Sai impresso na Ordem de Serviço."
      />
      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Abrindo…' : 'Abrir locação e gerar OS'}
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

/** Em duas etapas (abrir + confirmar com motivo) para nao cancelar num toque sem querer. */
function CancelarLocacao({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(cancelarLocacao, {});

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-red-600 dark:text-red-400">
        Cancelar
      </summary>
      <form action={acao} className="mt-2 flex flex-col gap-1">
        <input type="hidden" name="id" value={id} />
        <input
          name="motivo"
          placeholder="Motivo (ex.: cliente desistiu)"
          aria-label="Motivo do cancelamento"
          className="border-border-subtle bg-surface text-foreground rounded-md border px-2 py-1 text-xs"
        />
        <Botao type="submit" variante="perigo" disabled={enviando} className="px-3 py-1 text-xs">
          {enviando ? 'Cancelando…' : 'Confirmar cancelamento'}
        </Botao>
        {(estado.erro || estado.campos?.motivo) && (
          <span className="text-red-600 dark:text-red-400">
            {estado.erro ?? estado.campos?.motivo}
          </span>
        )}
      </form>
    </details>
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
      <div className="flex flex-col gap-2">
        <AcaoComData acaoServidor={registrarEntrega} id={id} campo="entregaEm" rotulo="Entregar" />
        <CancelarLocacao id={id} />
      </div>
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

export function TrocarMotorista({
  id,
  atual,
  motoristas,
}: {
  id: string;
  atual: string | null;
  motoristas: Opcao[];
}) {
  return (
    <form action={trocarMotorista}>
      <input type="hidden" name="id" value={id} />
      <select
        name="motoristaId"
        defaultValue={atual ?? ''}
        aria-label="Motorista"
        // Troca na hora: e so um campo, um botao "salvar" seria clique sobrando.
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border-border-subtle bg-surface text-foreground max-w-36 rounded-md border px-2 py-1 text-xs"
      >
        {!atual && <option value="">— escolher —</option>}
        {motoristas.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </form>
  );
}

export { formatarBRL };
