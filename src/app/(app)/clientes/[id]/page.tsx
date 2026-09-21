import { desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { col } from '@/db/sql';
import { cacambas, clientes, cobrancas, locacoes, prorrogacoes, recebimentos } from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import { formatarDocumento } from '@/lib/documento';
import { rotuloFormaCobranca } from '@/lib/dominio/faturamento';
import {
  resumirCarteira,
  saldoDevedor,
  statusCobranca,
  type StatusCobranca,
} from '@/lib/dominio/financeiro';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import { podeAcessar } from '@/lib/dominio/tipos';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { FormularioCliente } from '../formulario';

export const metadata = { title: 'Cliente' };
export const dynamic = 'force-dynamic';

const rotuloLocacao: Record<string, string> = {
  orcamento: 'Orçamento',
  agendada: 'Agendada',
  entregue: 'Entregue',
  retirada_solicitada: 'Retirada pedida',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const rotuloCobranca: Record<
  StatusCobranca,
  { texto: string; tom: 'neutro' | 'marca' | 'alerta' | 'sucesso' }
> = {
  aberta: { texto: 'Em aberto', tom: 'neutro' },
  parcial: { texto: 'Parcial', tom: 'marca' },
  paga: { texto: 'Paga', tom: 'sucesso' },
  vencida: { texto: 'Vencida', tom: 'alerta' },
  cancelada: { texto: 'Cancelada', tom: 'neutro' },
};

const data = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');

export default async function PaginaCliente({ params }: PageProps<'/clientes/[id]'>) {
  const usuario = await exigirPermissaoPagina('clientes.editar');
  const veDinheiro = podeAcessar(usuario.papel, 'financeiro.ver');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  if (!cliente) notFound();

  const [historico, contas] = await Promise.all([
    db
      .select({
        id: locacoes.id,
        numeroOs: locacoes.numeroOs,
        status: locacoes.status,
        endereco: locacoes.enderecoEntrega,
        entregaEm: locacoes.entregaEm,
        retiradaEm: locacoes.retiradaEm,
        numeracao: cacambas.numeracao,
        total:
          sql<number>`${locacoes.valorLocacao} + ${locacoes.valorFrete} + coalesce(${locacoes.multaApurada}, 0)
          + (select coalesce(sum(${prorrogacoes.valor}), 0) from ${prorrogacoes} where ${col(prorrogacoes.locacaoId)} = ${col(locacoes.id)})`.mapWith(
            Number,
          ),
      })
      .from(locacoes)
      .innerJoin(cacambas, eq(locacoes.cacambaId, cacambas.id))
      .where(eq(locacoes.clienteId, id))
      .orderBy(desc(locacoes.numeroOs)),
    veDinheiro
      ? db
          .select({
            id: cobrancas.id,
            descricao: cobrancas.descricao,
            valorTotal: cobrancas.valorTotal,
            vencimentoEm: cobrancas.vencimentoEm,
            cancelada: cobrancas.cancelada,
            recebido:
              sql<number>`(select coalesce(sum(${recebimentos.valor}), 0) from ${recebimentos}
              where ${col(recebimentos.cobrancaId)} = ${col(cobrancas.id)})`.mapWith(Number),
          })
          .from(cobrancas)
          .where(eq(cobrancas.clienteId, id))
          .orderBy(desc(cobrancas.vencimentoEm))
      : Promise.resolve([]),
  ]);

  const hoje = hojeEmSaoPaulo();
  // Um recebimento agregado por cobranca basta para saldo e situacao.
  const itens = contas.map((c) => {
    const recs = c.recebido > 0 ? [{ valor: c.recebido, recebidoEm: hoje }] : [];
    return { ...c, recs, status: statusCobranca(c, recs, hoje), saldo: saldoDevedor(c, recs) };
  });
  const resumo = resumirCarteira(
    itens.map((c) => ({ cobranca: c, recebimentos: c.recs })),
    hoje,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/clientes"
          className="text-navy-500 hover:text-brand-600 text-sm font-medium underline underline-offset-2"
        >
          ← Clientes
        </Link>
        <h1 className="font-display text-navy-700 mt-2 text-2xl font-extrabold dark:text-white">
          {cliente.nome}
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          {cliente.documento && `${formatarDocumento(cliente.documento)} · `}
          {cliente.telefone ?? 'sem telefone'} · cobrança{' '}
          {rotuloFormaCobranca(cliente.formaCobranca, cliente.periodoFatura).toLowerCase()}
        </p>
      </div>

      {veDinheiro && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { rotulo: 'Locações', valor: String(historico.length) },
            { rotulo: 'Faturado', valor: formatarBRL(resumo.faturado) },
            {
              rotulo: 'Em aberto',
              valor: formatarBRL(resumo.aReceber),
              destaque: resumo.aReceber > 0,
            },
            { rotulo: 'Vencido', valor: formatarBRL(resumo.vencido), perigo: resumo.vencido > 0 },
          ].map((ind) => (
            <Cartao key={ind.rotulo}>
              <p className="text-navy-500 dark:text-navy-200 text-sm">{ind.rotulo}</p>
              <p
                className={`font-display mt-2 text-2xl font-extrabold ${
                  ind.perigo
                    ? 'text-red-600 dark:text-red-400'
                    : ind.destaque
                      ? 'text-brand-600'
                      : 'text-navy-700 dark:text-white'
                }`}
              >
                {ind.valor}
              </p>
            </Cartao>
          ))}
        </div>
      )}

      <section>
        <TituloSecao>Locações</TituloSecao>
        {historico.length === 0 ? (
          <Cartao>
            <Vazio>Nenhuma locação ainda.</Vazio>
          </Cartao>
        ) : (
          <Tabela
            cabecalho={['OS', 'Caçamba', 'Endereço', 'Entrega', 'Retirada', 'Total', 'Situação']}
          >
            {historico.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/os/${l.id}`}
                    className="text-brand-600 font-semibold underline underline-offset-2"
                  >
                    Nº {l.numeroOs}
                  </Link>
                </td>
                <td className="text-navy-700 px-4 py-3 font-bold dark:text-white">{l.numeracao}</td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">{l.endereco}</td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {data(l.entregaEm)}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {data(l.retiradaEm)}
                </td>
                <td className="text-navy-700 px-4 py-3 whitespace-nowrap dark:text-white">
                  {formatarBRL(l.total)}
                </td>
                <td className="px-4 py-3">
                  <Etiqueta>{rotuloLocacao[l.status] ?? l.status}</Etiqueta>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>

      {veDinheiro && (
        <section>
          <TituloSecao>Cobranças</TituloSecao>
          {itens.length === 0 ? (
            <Cartao>
              <Vazio>Nenhuma cobrança ainda.</Vazio>
            </Cartao>
          ) : (
            <Tabela
              cabecalho={['Descrição', 'Vencimento', 'Total', 'Recebido', 'Saldo', 'Situação']}
            >
              {itens.map((c) => (
                <tr key={c.id}>
                  <td className="text-navy-600 dark:text-navy-100 px-4 py-3">{c.descricao}</td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                    {data(c.vencimentoEm)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatarBRL(c.valorTotal)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                    {formatarBRL(c.recebido)}
                  </td>
                  <td className="text-navy-700 px-4 py-3 font-semibold whitespace-nowrap dark:text-white">
                    {formatarBRL(c.saldo)}
                  </td>
                  <td className="px-4 py-3">
                    <Etiqueta tom={rotuloCobranca[c.status].tom}>
                      {rotuloCobranca[c.status].texto}
                    </Etiqueta>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </section>
      )}

      <Cartao>
        <TituloSecao>Editar cadastro</TituloSecao>
        <FormularioCliente
          inicial={cliente}
          podeCobranca={podeAcessar(usuario.papel, 'financeiro.registrar')}
        />
      </Cartao>
    </div>
  );
}
