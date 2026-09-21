import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
  sum,
  type AnyColumn,
} from 'drizzle-orm';
import Link from 'next/link';

import { Cartao, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { cacambas, clientes, cobrancas, locacoes, prorrogacoes, recebimentos } from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import { periodoDaFatura } from '@/lib/dominio/faturamento';
import { hojeEmSaoPaulo, STATUS_ATIVOS } from '@/lib/dominio/locacao';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

export const metadata = { title: 'Relatórios' };
export const dynamic = 'force-dynamic';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const FORMAS: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  cartao: 'Cartão',
};

const ORIGENS: Record<string, string> = {
  locacao: 'Locações',
  venda_material: 'Venda de material',
  fatura: 'Faturas',
};

function mesVizinho(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Dia (no fuso da operacao) em que um timestamp aconteceu. */
const diaSP = (coluna: AnyColumn) => sql`(${coluna} at time zone 'America/Sao_Paulo')::date`;

export default async function PaginaRelatorios({ searchParams }: PageProps<'/relatorios'>) {
  await exigirPermissaoPagina('financeiro.ver');
  const hoje = hojeEmSaoPaulo();
  const { mes: mesParam } = await searchParams;
  const mes =
    typeof mesParam === 'string' && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hoje.slice(0, 7);
  const { inicio, fim } = periodoDaFatura(`${mes}-01`, 'mensal');
  const noMes = <T,>(coluna: T) => sql`${coluna} between ${inicio} and ${fim}`;

  const db = getDb();
  const [
    faturadoPorOrigem,
    recebidoPorForma,
    operacao,
    trocas,
    extras,
    frota,
    ocupadas,
    topClientes,
    todosDevedores,
  ] = await Promise.all([
    db
      .select({
        origem: cobrancas.origem,
        total: sum(cobrancas.valorTotal).mapWith(Number),
        n: count(),
      })
      .from(cobrancas)
      .where(and(eq(cobrancas.cancelada, false), noMes(diaSP(cobrancas.criadoEm))))
      .groupBy(cobrancas.origem),
    db
      .select({ forma: recebimentos.forma, total: sum(recebimentos.valor).mapWith(Number) })
      .from(recebimentos)
      .where(and(gte(recebimentos.recebidoEm, inicio), lte(recebimentos.recebidoEm, fim)))
      .groupBy(recebimentos.forma),
    db
      .select({
        entregas: sql<number>`count(*) filter (where ${noMes(locacoes.entregaEm)})`.mapWith(Number),
        retiradas: sql<number>`count(*) filter (where ${noMes(locacoes.retiradaEm)})`.mapWith(
          Number,
        ),
        vendasEntulho:
          sql<number>`count(*) filter (where ${noMes(locacoes.retiradaEm)} and ${locacoes.destinoEntulho} = 'venda')`.mapWith(
            Number,
          ),
        multas:
          sql<number>`coalesce(sum(${locacoes.multaApurada}) filter (where ${noMes(locacoes.retiradaEm)}), 0)`.mapWith(
            Number,
          ),
      })
      .from(locacoes),
    db
      .select({ n: count() })
      .from(locacoes)
      .where(and(isNotNull(locacoes.trocaDeId), noMes(locacoes.entregaEm))),
    db
      .select({
        n: count(),
        dias: sum(prorrogacoes.dias).mapWith(Number),
        valor: sum(prorrogacoes.valor).mapWith(Number),
      })
      .from(prorrogacoes)
      .where(noMes(diaSP(prorrogacoes.criadoEm))),
    db
      .select({ n: count() })
      .from(cacambas)
      .where(sql`${cacambas.status} <> 'inativa'`),
    db
      .select({ n: sql<number>`count(distinct ${locacoes.cacambaId})`.mapWith(Number) })
      .from(locacoes)
      .where(inArray(locacoes.status, [...STATUS_ATIVOS])),
    db
      .select({
        id: clientes.id,
        nome: clientes.nome,
        total: sum(cobrancas.valorTotal).mapWith(Number),
      })
      .from(cobrancas)
      .innerJoin(clientes, eq(cobrancas.clienteId, clientes.id))
      .where(and(eq(cobrancas.cancelada, false), noMes(diaSP(cobrancas.criadoEm))))
      .groupBy(clientes.id, clientes.nome)
      .orderBy(desc(sum(cobrancas.valorTotal)))
      .limit(10),
    db
      .select({
        id: clientes.id,
        nome: clientes.nome,
        saldo: sql<number>`sum(greatest(0, ${cobrancas.valorTotal} - (
          select coalesce(sum(${recebimentos.valor}), 0) from ${recebimentos}
          where ${recebimentos.cobrancaId} = ${cobrancas.id})))`.mapWith(Number),
        vencido:
          sql<number>`sum(case when ${cobrancas.vencimentoEm} < ${hoje} then greatest(0, ${cobrancas.valorTotal} - (
          select coalesce(sum(${recebimentos.valor}), 0) from ${recebimentos}
          where ${recebimentos.cobrancaId} = ${cobrancas.id})) else 0 end)`.mapWith(Number),
      })
      .from(cobrancas)
      .innerJoin(clientes, eq(cobrancas.clienteId, clientes.id))
      .where(eq(cobrancas.cancelada, false))
      .groupBy(clientes.id, clientes.nome),
  ]);

  const faturado = faturadoPorOrigem.reduce((s, o) => s + (o.total ?? 0), 0);
  const recebido = recebidoPorForma.reduce((s, f) => s + (f.total ?? 0), 0);
  // Soma de TODOS os devedores; a lista mostra so os 10 maiores.
  const comSaldo = todosDevedores.filter((d) => d.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  const aberto = comSaldo.reduce((s, d) => s + d.saldo, 0);
  const devedores = comSaldo.slice(0, 10);
  const op = operacao[0];
  const ocupacao = frota[0].n > 0 ? Math.round((ocupadas[0].n / frota[0].n) * 100) : 0;
  const [ano, m] = mes.split('-').map(Number);

  const indicadores = [
    { rotulo: 'Faturado no mês', valor: formatarBRL(faturado) },
    { rotulo: 'Recebido no mês', valor: formatarBRL(recebido) },
    { rotulo: 'Entregas no mês', valor: String(op.entregas) },
    { rotulo: 'Frota ocupada agora', valor: `${ocupacao}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
            Relatórios
          </h1>
          <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm capitalize">
            {MESES[m - 1]} de {ano}
          </p>
        </div>
        <nav className="flex gap-2 text-sm font-medium">
          <Link
            href={`/relatorios?mes=${mesVizinho(mes, -1)}`}
            className="border-border-subtle text-navy-600 dark:text-navy-100 rounded-md border px-3 py-1.5"
          >
            ← Mês anterior
          </Link>
          {mes < hoje.slice(0, 7) && (
            <Link
              href={`/relatorios?mes=${mesVizinho(mes, 1)}`}
              className="border-border-subtle text-navy-600 dark:text-navy-100 rounded-md border px-3 py-1.5"
            >
              Próximo mês →
            </Link>
          )}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((ind) => (
          <Cartao key={ind.rotulo}>
            <p className="text-navy-500 dark:text-navy-200 text-sm">{ind.rotulo}</p>
            <p className="font-display text-navy-700 mt-2 text-2xl font-extrabold dark:text-white">
              {ind.valor}
            </p>
          </Cartao>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <TituloSecao>Faturado por origem</TituloSecao>
          {faturadoPorOrigem.length === 0 ? (
            <Vazio>Nada faturado neste mês.</Vazio>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {faturadoPorOrigem.map((o) => (
                <li key={o.origem} className="flex justify-between gap-4">
                  <span className="text-navy-600 dark:text-navy-100">
                    {ORIGENS[o.origem]} ({o.n})
                  </span>
                  <span className="text-navy-700 font-semibold dark:text-white">
                    {formatarBRL(o.total ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <TituloSecao>Recebido por forma de pagamento</TituloSecao>
          {recebidoPorForma.length === 0 ? (
            <Vazio>Nenhum recebimento neste mês.</Vazio>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {recebidoPorForma.map((f) => (
                <li key={f.forma} className="flex justify-between gap-4">
                  <span className="text-navy-600 dark:text-navy-100">{FORMAS[f.forma]}</span>
                  <span className="text-navy-700 font-semibold dark:text-white">
                    {formatarBRL(f.total ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <TituloSecao>Operação</TituloSecao>
          <ul className="flex flex-col gap-2 text-sm">
            {[
              ['Entregas', String(op.entregas)],
              ['Trocas', String(trocas[0].n)],
              ['Retiradas', String(op.retiradas)],
              ['Vendas de entulho', String(op.vendasEntulho)],
              [
                'Prorrogações',
                `${extras[0].n} (${extras[0].dias ?? 0} dias · ${formatarBRL(extras[0].valor ?? 0)})`,
              ],
              ['Multas apuradas', formatarBRL(op.multas)],
              ['Caçambas na rua agora', `${ocupadas[0].n} de ${frota[0].n}`],
            ].map(([rotulo, valor]) => (
              <li key={rotulo} className="flex justify-between gap-4">
                <span className="text-navy-600 dark:text-navy-100">{rotulo}</span>
                <span className="text-navy-700 font-semibold dark:text-white">{valor}</span>
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao>
          <TituloSecao>Clientes que mais faturaram no mês</TituloSecao>
          {topClientes.length === 0 ? (
            <Vazio>Nada faturado neste mês.</Vazio>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {topClientes.map((c) => (
                <li key={c.id} className="flex justify-between gap-4">
                  <Link
                    href={`/clientes/${c.id}`}
                    className="text-navy-600 hover:text-brand-600 dark:text-navy-100 underline-offset-2 hover:underline"
                  >
                    {c.nome}
                  </Link>
                  <span className="text-navy-700 font-semibold dark:text-white">
                    {formatarBRL(c.total ?? 0)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Cartao>
      </div>

      <section>
        <TituloSecao>Quem deve (hoje) — {formatarBRL(aberto)} em aberto</TituloSecao>
        {devedores.length === 0 ? (
          <Cartao>
            <Vazio>Ninguém devendo. 🎉</Vazio>
          </Cartao>
        ) : (
          <Tabela cabecalho={['Cliente', 'Em aberto', 'Vencido']}>
            {devedores.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/clientes/${d.id}`}
                    className="text-navy-700 hover:text-brand-600 font-medium underline-offset-2 hover:underline dark:text-white"
                  >
                    {d.nome}
                  </Link>
                </td>
                <td className="text-navy-700 px-4 py-3 font-semibold whitespace-nowrap dark:text-white">
                  {formatarBRL(d.saldo)}
                </td>
                <td
                  className={`px-4 py-3 whitespace-nowrap ${d.vencido > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-navy-400'}`}
                >
                  {formatarBRL(d.vencido)}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>
    </div>
  );
}
