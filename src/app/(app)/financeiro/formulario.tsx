'use client';

import { useActionState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import type { EstadoForm } from '@/server/validacao';

import { criarMaterial, registrarRecebimento, registrarVenda } from './actions';

const hoje = () => new Date().toISOString().slice(0, 10);

export function FormularioRecebimento({ cobrancaId }: { cobrancaId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(registrarRecebimento, {});

  return (
    <form action={acao} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="cobrancaId" value={cobrancaId} />
        <input
          name="valor"
          inputMode="decimal"
          placeholder="Valor"
          aria-label="Valor recebido"
          className="border-border-subtle bg-surface text-foreground w-24 rounded-md border px-2 py-1 text-xs"
        />
        <select
          name="forma"
          aria-label="Forma de pagamento"
          className="border-border-subtle bg-surface text-foreground rounded-md border px-2 py-1 text-xs"
        >
          <option value="pix">Pix</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="transferencia">Transferência</option>
          <option value="boleto">Boleto</option>
          <option value="cartao">Cartão</option>
        </select>
        <input
          type="date"
          name="recebidoEm"
          defaultValue={hoje()}
          aria-label="Data do recebimento"
          className="border-border-subtle bg-surface text-foreground rounded-md border px-2 py-1 text-xs"
        />
        <Botao type="submit" disabled={enviando} className="px-3 py-1 text-xs">
          Baixar
        </Botao>
      </div>
      {(estado.erro || estado.campos?.valor) && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {estado.erro ?? estado.campos?.valor}
        </span>
      )}
    </form>
  );
}

export function FormularioMaterial() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarMaterial, {});

  return (
    <form action={acao} className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <Campo
        label="Material"
        name="nome"
        placeholder="Brita reciclada"
        erro={estado.campos?.nome}
      />
      <Select label="Unidade" name="unidade" defaultValue="tonelada">
        <option value="tonelada">Tonelada</option>
        <option value="metro_cubico">Metro cúbico</option>
      </Select>
      <Campo
        label="Preço por unidade"
        name="precoUnitario"
        prefixo="R$"
        inputMode="decimal"
        erro={estado.campos?.precoUnitario}
      />
      <Botao type="submit" disabled={enviando} className="sm:mt-7 sm:self-start">
        {enviando ? 'Salvando…' : 'Adicionar'}
      </Botao>
      {estado.erro && (
        <p className="text-sm text-red-600 sm:col-span-4 dark:text-red-400">{estado.erro}</p>
      )}
    </form>
  );
}

type Opcao = { id: string; rotulo: string };

export function FormularioVenda({
  clientes,
  materiais,
}: {
  clientes: Opcao[];
  materiais: Opcao[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(registrarVenda, {});

  if (clientes.length === 0 || materiais.length === 0) {
    return (
      <p className="text-navy-500 dark:text-navy-200 text-sm">
        Cadastre ao menos um cliente e um material para registrar vendas.
      </p>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Cliente" name="clienteId">
          {clientes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
        <Select label="Material" name="materialId">
          {materiais.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          label="Quantidade"
          name="quantidade"
          inputMode="decimal"
          placeholder="2,750"
          dica="Até 3 casas decimais"
          erro={estado.campos?.quantidade}
        />
        <Campo label="Data da venda" name="vendidaEm" type="date" defaultValue={hoje()} />
        <Campo
          label="Prazo para pagar"
          name="prazoDias"
          type="number"
          min={0}
          max={180}
          defaultValue={0}
          dica="Dias até o vencimento"
        />
      </div>
      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar venda'}
        </Botao>
        {estado.erro && (
          <span className="text-sm text-red-600 dark:text-red-400">{estado.erro}</span>
        )}
      </div>
    </form>
  );
}
