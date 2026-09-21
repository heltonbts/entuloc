'use client';

import { useActionState } from 'react';

import { Botao, Campo, Select } from '@/components/ui';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import type { EstadoForm } from '@/server/validacao';

import { registrarAjuste, registrarEntrada, registrarProducao } from './actions';

type Opcao = { id: string; rotulo: string };

function Rodape({
  estado,
  enviando,
  rotulo,
}: {
  estado: EstadoForm;
  enviando: boolean;
  rotulo: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Botao type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : rotulo}
      </Botao>
      {estado.ok && (
        <span className="text-sm text-emerald-700 dark:text-emerald-300">Registrado.</span>
      )}
      {estado.erro && <span className="text-sm text-red-600 dark:text-red-400">{estado.erro}</span>}
    </div>
  );
}

export function FormularioProducao({ materiais }: { materiais: Opcao[] }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(registrarProducao, {});
  if (materiais.length === 0) {
    return (
      <p className="text-navy-500 dark:text-navy-200 text-sm">
        Cadastre os materiais (areia, brita…) no Financeiro para registrar a produção.
      </p>
    );
  }
  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Select label="Material produzido" name="materialId" id="producao-material">
          {materiais.map((m) => (
            <option key={m.id} value={m.id}>
              {m.rotulo}
            </option>
          ))}
        </Select>
        <Campo
          label="Quantidade produzida"
          name="quantidade"
          id="producao-quantidade"
          inputMode="decimal"
          placeholder="12,5"
          dica="Na unidade do material"
          erro={estado.campos?.quantidade}
        />
        <Campo
          label="Entulho consumido (m³)"
          name="consumo"
          id="producao-consumo"
          inputMode="decimal"
          placeholder="opcional"
          erro={estado.campos?.consumo}
        />
        <Campo
          label="Data"
          name="ocorridoEm"
          id="producao-data"
          type="date"
          defaultValue={hojeEmSaoPaulo()}
        />
      </div>
      <Campo label="Observação" name="observacao" id="producao-obs" placeholder="opcional" />
      <Rodape estado={estado} enviando={enviando} rotulo="Registrar produção" />
    </form>
  );
}

export function FormularioEntrada() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(registrarEntrada, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_2fr]">
        <Campo
          label="Entulho recebido (m³)"
          name="quantidade"
          id="entrada-quantidade"
          inputMode="decimal"
          placeholder="4"
          erro={estado.campos?.quantidade}
        />
        <Campo
          label="Data"
          name="ocorridoEm"
          id="entrada-data"
          type="date"
          defaultValue={hojeEmSaoPaulo()}
        />
        <Campo
          label="De onde veio"
          name="observacao"
          id="entrada-obs"
          placeholder="Ex.: caminhão de terceiro, obra X"
          erro={estado.campos?.observacao}
        />
      </div>
      <Rodape estado={estado} enviando={enviando} rotulo="Registrar entrada" />
    </form>
  );
}

export function FormularioAjuste({ materiais }: { materiais: Opcao[] }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(registrarAjuste, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Select label="O que ajustar" name="alvo" id="ajuste-alvo">
          <option value="entulho">Entulho bruto (m³)</option>
          {materiais.map((m) => (
            <option key={m.id} value={m.id}>
              {m.rotulo}
            </option>
          ))}
        </Select>
        <Campo
          label="Quantidade"
          name="quantidade"
          id="ajuste-quantidade"
          inputMode="decimal"
          placeholder="-1,5 ou 3"
          dica="Negativo tira, positivo põe"
          erro={estado.campos?.quantidade}
        />
        <Campo
          label="Data"
          name="ocorridoEm"
          id="ajuste-data"
          type="date"
          defaultValue={hojeEmSaoPaulo()}
        />
      </div>
      <Campo
        label="Motivo"
        name="observacao"
        id="ajuste-obs"
        placeholder="Ex.: contagem do inventário, perda na chuva"
        erro={estado.campos?.observacao}
      />
      <Rodape estado={estado} enviando={enviando} rotulo="Registrar ajuste" />
    </form>
  );
}
