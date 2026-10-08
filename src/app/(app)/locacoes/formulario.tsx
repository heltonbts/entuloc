'use client';

import { useActionState, useState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import { formatarBRL, formatarValor } from '@/lib/dinheiro';
import { hojeEmSaoPaulo, VALOR_PRORROGACAO_PADRAO } from '@/lib/dominio/locacao';
import type { EstadoForm } from '@/server/validacao';

import {
  apagarLocacao,
  cancelarLocacao,
  concluirLocacao,
  criarLocacao,
  pedirTroca,
  prorrogar,
  registrarEntrega,
  solicitarRetirada,
  trocarMotorista,
} from './actions';

// No fuso da operacao: toISOString() e UTC e, a noite, ja seria o dia seguinte.
const hoje = () => hojeEmSaoPaulo();

type Opcao = { id: string; rotulo: string };

export type OpcaoCliente = Opcao & { endereco: string; cidade: string; uf: string };
export type OpcaoCacamba = Opcao & { valor: number };
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
  cacambas: OpcaoCacamba[];
  cidades: OpcaoCidade[];
  regras: Opcao[];
  motoristas: Opcao[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarLocacao, {});

  const inicial = cidadeDoCliente(clientes[0], cidades) ?? cidades[0];
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '');
  const [cidadeId, setCidadeId] = useState(inicial?.id ?? '');
  const [frete, setFrete] = useState(inicial ? formatarValor(inicial.frete) : '');
  const [cacambaId, setCacambaId] = useState(cacambas[0]?.id ?? '');
  const [valor, setValor] = useState(cacambas[0]?.valor ? formatarValor(cacambas[0].valor) : '');

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

  function escolherCacamba(id: string) {
    setCacambaId(id);
    const cacamba = cacambas.find((c) => c.id === id);
    if (cacamba) setValor(cacamba.valor ? formatarValor(cacamba.valor) : '');
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
        <Select
          label="Caçamba disponível"
          name="cacambaId"
          value={cacambaId}
          onChange={(e) => escolherCacamba(e.target.value)}
        >
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
      <Campo
        label="Valor da locação"
        name="valorLocacao"
        prefixo="R$"
        inputMode="decimal"
        placeholder="0,00"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        dica="Vem da tabela do tipo; mude se combinou outro preço com o cliente."
        erro={estado.campos?.valorLocacao}
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

/** Some com a OS de vez: em duas etapas, e avisando o que vai junto. */
function ApagarLocacao({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(apagarLocacao, {});

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-red-600 dark:text-red-400">
        Apagar
      </summary>
      <form action={acao} className="mt-2 flex max-w-48 flex-col gap-1">
        <input type="hidden" name="id" value={id} />
        <span className="text-navy-500 dark:text-navy-200">
          Apaga a OS, as fotos e as cobranças dela. Não dá para desfazer.
        </span>
        <Botao type="submit" variante="perigo" disabled={enviando} className="px-3 py-1 text-xs">
          {enviando ? 'Apagando…' : 'Apagar de vez'}
        </Botao>
        {estado.erro && <span className="text-red-600 dark:text-red-400">{estado.erro}</span>}
      </form>
    </details>
  );
}

function PedirTroca({
  id,
  cacambasLivres,
  freteCidade,
  valorLocacao,
}: {
  id: string;
  cacambasLivres: Opcao[];
  freteCidade: number;
  valorLocacao: number;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(pedirTroca, {});

  return (
    <details className="text-xs">
      <summary className="text-brand-600 cursor-pointer font-medium">Pedir troca</summary>
      {cacambasLivres.length === 0 ? (
        <p className="text-navy-400 mt-2">Nenhuma caçamba livre para levar.</p>
      ) : (
        <form action={acao} className="mt-2 flex flex-col gap-1">
          <input type="hidden" name="id" value={id} />
          <select
            name="cacambaId"
            aria-label="Caçamba vazia"
            className="border-border-subtle bg-surface text-foreground rounded-md border px-2 py-1 text-xs"
          >
            {cacambasLivres.map((o) => (
              <option key={o.id} value={o.id}>
                Levar {o.rotulo}
              </option>
            ))}
          </select>
          <label className="text-navy-500 flex items-center gap-1">
            Valor R$
            <input
              name="valorLocacao"
              defaultValue={formatarValor(valorLocacao)}
              inputMode="decimal"
              className="border-border-subtle bg-surface text-foreground w-20 rounded-md border px-2 py-1 text-xs"
            />
          </label>
          <label className="text-navy-500 flex items-center gap-1">
            Frete R$
            <input
              name="valorFrete"
              defaultValue={formatarValor(freteCidade)}
              inputMode="decimal"
              className="border-border-subtle bg-surface text-foreground w-20 rounded-md border px-2 py-1 text-xs"
            />
          </label>
          <Botao type="submit" disabled={enviando} className="px-3 py-1 text-xs">
            {enviando ? 'Gerando…' : 'Gerar OS de troca'}
          </Botao>
          {(estado.erro || estado.campos) && (
            <span className="text-red-600 dark:text-red-400">
              {estado.erro ?? Object.values(estado.campos ?? {})[0]}
            </span>
          )}
        </form>
      )}
    </details>
  );
}

function Prorrogar({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(prorrogar, {});

  return (
    <details className="text-xs">
      <summary className="text-brand-600 cursor-pointer font-medium">Prorrogar</summary>
      <form action={acao} className="mt-2 flex flex-col gap-1">
        <input type="hidden" name="id" value={id} />
        <label className="text-navy-500 flex items-center gap-1">
          Dias a mais
          <input
            name="dias"
            type="number"
            min={1}
            defaultValue={1}
            className="border-border-subtle bg-surface text-foreground w-14 rounded-md border px-2 py-1 text-xs"
          />
        </label>
        <label className="text-navy-500 flex items-center gap-1">
          Valor R$
          <input
            name="valor"
            defaultValue={formatarValor(VALOR_PRORROGACAO_PADRAO)}
            inputMode="decimal"
            className="border-border-subtle bg-surface text-foreground w-20 rounded-md border px-2 py-1 text-xs"
          />
        </label>
        <Botao type="submit" disabled={enviando} className="px-3 py-1 text-xs">
          {enviando ? 'Salvando…' : 'Confirmar prorrogação'}
        </Botao>
        {estado.ok && <span className="text-emerald-700 dark:text-emerald-300">Prorrogado.</span>}
        {(estado.erro || estado.campos) && (
          <span className="text-red-600 dark:text-red-400">
            {estado.erro ?? Object.values(estado.campos ?? {})[0]}
          </span>
        )}
      </form>
    </details>
  );
}

export type DadosAcoes = {
  id: string;
  status: string;
  podeFechar: boolean;
  podeApagar: boolean;
  /** Esta locacao e a OS de uma troca (entra a vazia). */
  ehTroca: boolean;
  /** Esta locacao (cheia) ja tem uma troca agendada. */
  trocaAgendada: boolean;
  valorLocacao: number;
  freteCidade: number;
  cacambasLivres: Opcao[];
};

export function AcoesLocacao(d: DadosAcoes) {
  if (!d.podeApagar) return <AcoesDoStatus {...d} />;
  return (
    <div className="flex flex-col gap-2">
      <AcoesDoStatus {...d} />
      <ApagarLocacao id={d.id} />
    </div>
  );
}

function AcoesDoStatus(d: DadosAcoes) {
  const nota = (texto: string) => <span className="text-navy-400 text-xs">{texto}</span>;

  if (d.status === 'agendada') {
    return (
      <div className="flex flex-col gap-2">
        {d.ehTroca ? (
          nota('Troca: motorista registra no app')
        ) : (
          <AcaoComData
            acaoServidor={registrarEntrega}
            id={d.id}
            campo="entregaEm"
            rotulo="Entregar"
          />
        )}
        <CancelarLocacao id={d.id} />
      </div>
    );
  }

  const noCliente = d.status === 'entregue' || d.status === 'retirada_solicitada';
  if (!noCliente) return nota('—');
  if (d.trocaAgendada) return nota('Troca agendada');

  return (
    <div className="flex flex-col gap-2">
      {d.status === 'entregue' && (
        <AcaoComData
          acaoServidor={solicitarRetirada}
          id={d.id}
          campo="em"
          rotulo="Pedir retirada"
        />
      )}
      {d.status === 'retirada_solicitada' &&
        (d.podeFechar ? (
          <AcaoComData
            acaoServidor={concluirLocacao}
            id={d.id}
            campo="retiradaEm"
            rotulo="Concluir"
          />
        ) : (
          nota('Aguardando retirada')
        ))}
      <PedirTroca
        id={d.id}
        cacambasLivres={d.cacambasLivres}
        freteCidade={d.freteCidade}
        valorLocacao={d.valorLocacao}
      />
      {d.status === 'entregue' && <Prorrogar id={d.id} />}
    </div>
  );
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
