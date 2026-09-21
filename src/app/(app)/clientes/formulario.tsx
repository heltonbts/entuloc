'use client';

import { useActionState, useState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import type { EstadoForm } from '@/server/validacao';

import { atualizarCliente, criarCliente } from './actions';

export type DadosCliente = {
  id: string;
  nome: string;
  tipoPessoa: 'fisica' | 'juridica';
  construtora: boolean;
  endereco: string;
  cidade: string;
  uf: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  formaCobranca: 'entrega' | 'retirada' | 'periodo';
  periodoFatura: 'semanal' | 'quinzenal' | 'mensal' | null;
  prazoPagamentoDias: number;
};

const formas = {
  entrega: 'Na entrega (extras na retirada)',
  retirada: 'Na retirada (tudo junto)',
  periodo: 'Fatura por período',
} as const;

function CamposCobranca({
  inicial,
  erros,
}: {
  inicial?: DadosCliente;
  erros?: EstadoForm['campos'];
}) {
  const [forma, setForma] = useState(inicial?.formaCobranca ?? 'retirada');

  return (
    <fieldset className="border-border-subtle flex flex-col gap-3 rounded-lg border p-4">
      <legend className="text-navy-700 px-1 text-sm font-semibold dark:text-white">Cobrança</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Quando cobrar"
          name="formaCobranca"
          value={forma}
          onChange={(e) => setForma(e.target.value as typeof forma)}
        >
          {Object.entries(formas).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Select>
        {forma === 'periodo' && (
          <>
            <Select
              label="Período"
              name="periodoFatura"
              defaultValue={inicial?.periodoFatura ?? 'mensal'}
            >
              <option value="semanal">Semanal (seg a dom)</option>
              <option value="quinzenal">Quinzenal (1–15, 16–fim)</option>
              <option value="mensal">Mensal</option>
            </Select>
            <Campo
              label="Prazo para pagar"
              name="prazoPagamentoDias"
              type="number"
              min={0}
              max={120}
              defaultValue={inicial?.prazoPagamentoDias ?? 0}
              dica="Dias depois do fim do período"
              erro={erros?.prazoPagamentoDias}
            />
          </>
        )}
      </div>
      <p className="text-navy-400 text-xs">
        {forma === 'entrega' &&
          'Locação + frete são cobrados quando a caçamba chega. Prorrogação e multa viram outra cobrança na retirada.'}
        {forma === 'retirada' && 'Uma cobrança só, com tudo somado, quando a caçamba volta.'}
        {forma === 'periodo' &&
          'As locações fechadas no período viram uma fatura única, gerada no Financeiro quando o período termina.'}
      </p>
    </fieldset>
  );
}

/** Cadastro (sem `inicial`) ou edicao (com `inicial`) do cliente. */
export function FormularioCliente({
  inicial,
  podeCobranca,
}: {
  inicial?: DadosCliente;
  /** So o gestor define a forma de cobranca. */
  podeCobranca: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(
    inicial ? atualizarCliente : criarCliente,
    {},
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Campo
          label="Nome ou razão social"
          name="nome"
          defaultValue={inicial?.nome}
          erro={estado.campos?.nome}
        />
        <Select label="Tipo" name="tipoPessoa" defaultValue={inicial?.tipoPessoa ?? 'fisica'}>
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
          defaultValue={inicial?.documento ?? undefined}
          erro={estado.campos?.documento}
        />
        <Campo
          label="Telefone"
          name="telefone"
          placeholder="opcional"
          defaultValue={inicial?.telefone ?? undefined}
        />
        <Campo
          label="E-mail"
          name="email"
          type="email"
          placeholder="opcional"
          defaultValue={inicial?.email ?? undefined}
          erro={estado.campos?.email}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[3fr_2fr_1fr]">
        <Campo
          label="Endereço"
          name="endereco"
          placeholder="Rua, número, bairro"
          defaultValue={inicial?.endereco}
          erro={estado.campos?.endereco}
        />
        <Campo
          label="Cidade"
          name="cidade"
          defaultValue={inicial?.cidade}
          erro={estado.campos?.cidade}
        />
        <Campo
          label="UF"
          name="uf"
          maxLength={2}
          placeholder="SP"
          defaultValue={inicial?.uf}
          erro={estado.campos?.uf}
        />
      </div>
      <label className="text-navy-700 dark:text-navy-100 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="construtora"
          defaultChecked={inicial?.construtora}
          className="accent-brand-600 size-4 rounded"
        />
        <span className="font-medium">É construtora</span>
      </label>

      {podeCobranca && <CamposCobranca inicial={inicial} erros={estado.campos} />}

      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : inicial ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Botao>
        {estado.ok && inicial && (
          <span className="text-sm text-emerald-700 dark:text-emerald-300">Salvo.</span>
        )}
        {estado.erro && (
          <span className="text-sm text-red-600 dark:text-red-400">{estado.erro}</span>
        )}
      </div>
    </form>
  );
}
