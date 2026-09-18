'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import { calcularMulta } from '@/lib/dominio/orcamento';
import type { RegraMulta } from '@/lib/dominio/tipos';
import { formatarBRL, parseBps, parseCentavos } from '@/lib/dinheiro';
import type { EstadoForm } from '@/server/validacao';

import { alternarRegra, criarRegraMulta } from './actions';

/** Valor de referencia da previa: a caçamba de 4 m³. */
const LOCACAO_EXEMPLO = 50_000;

export function FormularioRegraMulta() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarRegraMulta, {});
  const form = useRef<HTMLFormElement>(null);

  const [base, setBase] = useState<'percentual' | 'valor_fixo'>('percentual');
  const [valor, setValor] = useState('10');
  const [cobranca, setCobranca] = useState<'unica' | 'por_dia'>('por_dia');
  const [carencia, setCarencia] = useState('0');

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  // Previa do que a regra cobra de fato, para 3 dias de atraso. Sem isso, o
  // gestor so descobre o efeito da regra quando ela ja caiu num cliente.
  let previa: string | null = null;
  try {
    const regra: RegraMulta = {
      id: 'previa',
      nome: 'previa',
      base,
      percentualBps: base === 'percentual' ? parseBps(valor) : undefined,
      valorFixo: base === 'valor_fixo' ? parseCentavos(valor) : undefined,
      cobranca,
      diasCarencia: Number(carencia) || 0,
      ativa: true,
    };
    previa = formatarBRL(calcularMulta(regra, LOCACAO_EXEMPLO, 3));
  } catch {
    previa = null;
  }

  return (
    <form ref={form} action={acao} className="flex flex-col gap-4">
      <Campo
        label="Nome da regra"
        name="nome"
        placeholder="10% ao dia de atraso"
        erro={estado.campos?.nome}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Base de cálculo"
          name="base"
          value={base}
          onChange={(e) => {
            setBase(e.target.value as typeof base);
            setValor(e.target.value === 'percentual' ? '10' : '50,00');
          }}
        >
          <option value="percentual">Percentual sobre a locação</option>
          <option value="valor_fixo">Valor fixo</option>
        </Select>

        {base === 'percentual' ? (
          <Campo
            label="Percentual"
            name="percentualBps"
            prefixo="%"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            erro={estado.campos?.percentualBps}
          />
        ) : (
          <Campo
            label="Valor"
            name="valorFixo"
            prefixo="R$"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            erro={estado.campos?.valorFixo}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Cobrança"
          name="cobranca"
          value={cobranca}
          onChange={(e) => setCobranca(e.target.value as typeof cobranca)}
        >
          <option value="por_dia">Por dia de atraso</option>
          <option value="unica">Uma vez só</option>
        </Select>
        <Campo
          label="Carência"
          name="diasCarencia"
          type="number"
          min={0}
          value={carencia}
          onChange={(e) => setCarencia(e.target.value)}
          dica="Dias de atraso tolerados"
          erro={estado.campos?.diasCarencia}
        />
        <Campo
          label="Teto máximo"
          name="tetoMaximo"
          prefixo="R$"
          inputMode="decimal"
          placeholder="sem limite"
          erro={estado.campos?.tetoMaximo}
        />
      </div>

      {previa && (
        <p className="border-brand-500 bg-brand-50 text-navy-700 dark:bg-navy-800 dark:text-navy-100 rounded-md border-l-4 px-4 py-3 text-sm">
          Numa locação de {formatarBRL(LOCACAO_EXEMPLO)} com <strong>3 dias</strong> de atraso, esta
          regra cobra <strong>{previa}</strong>.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Cadastrar regra'}
        </Botao>
        {estado.erro && (
          <span className="text-sm text-red-600 dark:text-red-400">{estado.erro}</span>
        )}
      </div>
    </form>
  );
}

export function BotaoAlternar({ id, ativa }: { id: string; ativa: boolean }) {
  const [, acao, enviando] = useActionState<EstadoForm, FormData>(alternarRegra, {});

  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativa" value={String(!ativa)} />
      <Botao type="submit" variante="secundario" disabled={enviando} className="px-3 py-1 text-xs">
        {ativa ? 'Desativar' : 'Ativar'}
      </Botao>
    </form>
  );
}
