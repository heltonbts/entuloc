import { and, asc, gte, lte } from 'drizzle-orm';
import Link from 'next/link';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { despesas } from '@/db/schema';
import { formatarBRL, formatarPercentual } from '@/lib/dinheiro';
import { periodoDaFatura } from '@/lib/dominio/faturamento';
import {
  aPagarDaDespesa,
  DIVISAO_DESPESA,
  statusDespesa,
  type StatusDespesa,
} from '@/lib/dominio/financeiro';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import { MESES, mesVizinho } from '@/lib/mes';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { ApagarDespesa, EditarDespesa, FormularioDespesa, MarcarParte } from './formulario';

export const metadata = { title: 'Despesas' };
export const dynamic = 'force-dynamic';

const tomStatus: Record<StatusDespesa, 'neutro' | 'marca' | 'alerta' | 'sucesso'> = {
  aberta: 'neutro',
  parcial: 'marca',
  paga: 'sucesso',
  vencida: 'alerta',
};

const rotuloStatus: Record<StatusDespesa, string> = {
  aberta: 'Em aberto',
  parcial: 'Parcial',
  paga: 'Paga',
  vencida: 'Vencida',
};

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default async function PaginaDespesas({ searchParams }: PageProps<'/despesas'>) {
  await exigirPermissaoPagina('financeiro.ver');
  const hoje = hojeEmSaoPaulo();
  const { mes: mesParam } = await searchParams;
  const mes =
    typeof mesParam === 'string' && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hoje.slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const { inicio, fim } = periodoDaFatura(`${mes}-01`, 'mensal');

  const linhas = await getDb()
    .select()
    .from(despesas)
    .where(and(gte(despesas.vencimentoEm, inicio), lte(despesas.vencimentoEm, fim)))
    .orderBy(asc(despesas.vencimentoEm), asc(despesas.criadoEm));

  const lista = linhas.map((d) => {
    const partes = [
      { valor: d.parte1, pagaEm: d.parte1PagaEm },
      { valor: d.parte2, pagaEm: d.parte2PagaEm },
      { valor: d.parte3, pagaEm: d.parte3PagaEm },
      { valor: d.parte4, pagaEm: d.parte4PagaEm },
    ];
    return {
      ...d,
      partes,
      aPagar: aPagarDaDespesa(partes),
      status: statusDespesa(partes, d.vencimentoEm, hoje),
    };
  });

  const total = lista.reduce(
    (t, d) => ({
      valor: t.valor + d.valor,
      aPagar: t.aPagar + d.aPagar,
      partes: t.partes.map((soma, i) => soma + d.partes[i].valor),
    }),
    { valor: 0, aPagar: 0, partes: [0, 0, 0, 0] },
  );

  const indicadores = [
    { rotulo: 'Total do mês', valor: total.valor, destaque: false },
    { rotulo: 'Pago', valor: total.valor - total.aPagar, destaque: false },
    { rotulo: 'A pagar', valor: total.aPagar, destaque: total.aPagar > 0 },
  ];

  const rotulosPartes = [
    ...DIVISAO_DESPESA.map((bps, i) => `Parte ${i + 1} · ${formatarPercentual(bps)}%`),
    'EntuLoc · integral',
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
            Despesas
          </h1>
          <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
            Cada lançamento é dividido em três partes (
            {DIVISAO_DESPESA.map((bps) => `${formatarPercentual(bps)}%`).join(', ')}) ou fica
            inteiro com a EntuLoc. Marque o quadradinho de cada parte quando ela for paga.
          </p>
        </div>
        <nav className="flex gap-2 text-sm font-medium">
          <Link
            href={`/despesas?mes=${mesVizinho(mes, -1)}`}
            className="border-border-subtle text-navy-600 dark:text-navy-100 rounded-md border px-3 py-1.5"
          >
            ← Mês anterior
          </Link>
          {mes < hoje.slice(0, 7) && (
            <Link
              href={`/despesas?mes=${mesVizinho(mes, 1)}`}
              className="border-border-subtle text-navy-600 dark:text-navy-100 rounded-md border px-3 py-1.5"
            >
              Próximo mês →
            </Link>
          )}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {indicadores.map((ind) => (
          <Cartao key={ind.rotulo}>
            <p className="text-navy-500 dark:text-navy-200 text-sm">{ind.rotulo}</p>
            <p
              className={`font-display mt-2 text-2xl font-extrabold ${
                ind.destaque ? 'text-brand-600' : 'text-navy-700 dark:text-white'
              }`}
            >
              {formatarBRL(ind.valor)}
            </p>
          </Cartao>
        ))}
      </div>

      <Cartao>
        <TituloSecao>Lançar despesa</TituloSecao>
        <FormularioDespesa />
      </Cartao>

      <section>
        <TituloSecao>
          <span className="capitalize">
            {MESES[m - 1]} de {ano}
          </span>
        </TituloSecao>
        {lista.length === 0 ? (
          <Cartao>
            <Vazio>Nenhuma despesa com vencimento neste mês.</Vazio>
          </Cartao>
        ) : (
          <Tabela
            cabecalho={['Vencimento', 'Descrição', 'Valor', ...rotulosPartes, 'Situação', '']}
          >
            {lista.map((d) => (
              <tr key={d.id} className="align-top">
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {formatarData(d.vencimentoEm)}
                </td>
                <td className="text-navy-700 px-4 py-3 font-medium dark:text-white">
                  {d.descricao}
                </td>
                <td className="text-navy-700 px-4 py-3 font-semibold whitespace-nowrap dark:text-white">
                  {formatarBRL(d.valor)}
                </td>
                {d.partes.map((parte, i) => (
                  <td
                    key={i}
                    className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap"
                  >
                    {parte.valor > 0 ? (
                      <>
                        {formatarBRL(parte.valor)}
                        <MarcarParte
                          id={d.id}
                          parte={(i + 1) as 1 | 2 | 3 | 4}
                          rotulo={rotulosPartes[i]}
                          pagaEm={parte.pagaEm}
                        />
                      </>
                    ) : (
                      <span className="text-navy-300 dark:text-navy-400">—</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <Etiqueta tom={tomStatus[d.status]}>{rotuloStatus[d.status]}</Etiqueta>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <EditarDespesa
                      id={d.id}
                      descricao={d.descricao}
                      valor={d.valor}
                      vencimentoEm={d.vencimentoEm}
                      integralEntuloc={d.parte4 > 0}
                      algumaPaga={d.partes.some((p) => p.pagaEm)}
                    />
                    <ApagarDespesa id={d.id} />
                  </div>
                </td>
              </tr>
            ))}
            <tr className="text-navy-700 font-semibold dark:text-white">
              <td colSpan={2} className="px-4 py-3">
                Total do mês
              </td>
              {[total.valor, ...total.partes].map((valor, i) => (
                <td key={i} className="px-4 py-3 whitespace-nowrap">
                  {formatarBRL(valor)}
                </td>
              ))}
              <td colSpan={2} />
            </tr>
          </Tabela>
        )}
      </section>
    </div>
  );
}
