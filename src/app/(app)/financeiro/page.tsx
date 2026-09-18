import { asc, desc, eq } from 'drizzle-orm';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { clientes, cobrancas, materiais, recebimentos } from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import {
  resumirCarteira,
  saldoDevedor,
  statusCobranca,
  totalRecebido,
  type StatusCobranca,
} from '@/lib/dominio/financeiro';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { FormularioMaterial, FormularioRecebimento, FormularioVenda } from './formulario';

export const metadata = { title: 'Financeiro' };
export const dynamic = 'force-dynamic';

const tomStatus: Record<StatusCobranca, 'neutro' | 'marca' | 'alerta' | 'sucesso'> = {
  aberta: 'neutro',
  parcial: 'marca',
  paga: 'sucesso',
  vencida: 'alerta',
  cancelada: 'neutro',
};

const rotuloStatus: Record<StatusCobranca, string> = {
  aberta: 'Em aberto',
  parcial: 'Parcial',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default async function PaginaFinanceiro() {
  await exigirPermissaoPagina('financeiro.ver');
  const db = getDb();
  const hoje = new Date().toISOString().slice(0, 10);

  const [linhasCobranca, linhasRecebimento, opcoesCliente, opcoesMaterial, listaMateriais] =
    await Promise.all([
      db
        .select({
          id: cobrancas.id,
          descricao: cobrancas.descricao,
          valorTotal: cobrancas.valorTotal,
          vencimentoEm: cobrancas.vencimentoEm,
          cancelada: cobrancas.cancelada,
          origem: cobrancas.origem,
          cliente: clientes.nome,
        })
        .from(cobrancas)
        .innerJoin(clientes, eq(cobrancas.clienteId, clientes.id))
        .orderBy(asc(cobrancas.vencimentoEm)),
      db.select().from(recebimentos),
      db
        .select({ id: clientes.id, rotulo: clientes.nome })
        .from(clientes)
        .orderBy(asc(clientes.nome)),
      db
        .select({
          id: materiais.id,
          nome: materiais.nome,
          preco: materiais.precoUnitario,
          unidade: materiais.unidade,
        })
        .from(materiais)
        .where(eq(materiais.ativo, true))
        .orderBy(asc(materiais.nome)),
      db.select().from(materiais).orderBy(desc(materiais.criadoEm)),
    ]);

  const porCobranca = new Map<string, { valor: number; recebidoEm: string }[]>();
  for (const r of linhasRecebimento) {
    const lista = porCobranca.get(r.cobrancaId) ?? [];
    lista.push({ valor: r.valor, recebidoEm: r.recebidoEm });
    porCobranca.set(r.cobrancaId, lista);
  }

  const itens = linhasCobranca.map((c) => {
    const recs = porCobranca.get(c.id) ?? [];
    const cobranca = {
      valorTotal: c.valorTotal,
      vencimentoEm: c.vencimentoEm,
      cancelada: c.cancelada,
    };
    return {
      ...c,
      recebido: totalRecebido(recs),
      saldo: saldoDevedor(cobranca, recs),
      status: statusCobranca(cobranca, recs, hoje),
    };
  });

  const resumo = resumirCarteira(
    linhasCobranca.map((c) => ({
      cobranca: { valorTotal: c.valorTotal, vencimentoEm: c.vencimentoEm, cancelada: c.cancelada },
      recebimentos: porCobranca.get(c.id) ?? [],
    })),
    hoje,
  );

  const indicadores = [
    { rotulo: 'Faturado', valor: formatarBRL(resumo.faturado), destaque: false },
    { rotulo: 'Recebido', valor: formatarBRL(resumo.recebido), destaque: false },
    { rotulo: 'A receber', valor: formatarBRL(resumo.aReceber), destaque: true },
    {
      rotulo: `Vencido${resumo.quantidadeVencidas > 0 ? ` (${resumo.quantidadeVencidas})` : ''}`,
      valor: formatarBRL(resumo.vencido),
      destaque: resumo.vencido > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Financeiro
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Contas a receber de locações e de venda de material reciclado. O saldo é sempre
          recalculado a partir dos recebimentos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((ind) => (
          <Cartao key={ind.rotulo}>
            <p className="text-navy-500 dark:text-navy-200 text-sm">{ind.rotulo}</p>
            <p
              className={`font-display mt-2 text-2xl font-extrabold ${
                ind.destaque ? 'text-brand-600' : 'text-navy-700 dark:text-white'
              }`}
            >
              {ind.valor}
            </p>
          </Cartao>
        ))}
      </div>

      <section>
        <TituloSecao>Contas a receber</TituloSecao>
        {itens.length === 0 ? (
          <Cartao>
            <Vazio>
              Nenhuma cobrança ainda. Elas nascem ao concluir uma locação ou registrar uma venda.
            </Vazio>
          </Cartao>
        ) : (
          <Tabela
            cabecalho={[
              'Cliente',
              'Descrição',
              'Vencimento',
              'Total',
              'Recebido',
              'Saldo',
              'Situação',
              'Baixa',
            ]}
          >
            {itens.map((c) => (
              <tr key={c.id}>
                <td className="text-navy-700 px-4 py-3 font-medium dark:text-white">{c.cliente}</td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                  {c.descricao}
                  <span className="text-navy-400 block text-xs">
                    {c.origem === 'locacao' ? 'Locação' : 'Venda de material'}
                  </span>
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {formatarData(c.vencimentoEm)}
                </td>
                <td className="text-navy-700 px-4 py-3 whitespace-nowrap dark:text-white">
                  {formatarBRL(c.valorTotal)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                  {formatarBRL(c.recebido)}
                </td>
                <td className="text-navy-700 px-4 py-3 font-semibold whitespace-nowrap dark:text-white">
                  {formatarBRL(c.saldo)}
                </td>
                <td className="px-4 py-3">
                  <Etiqueta tom={tomStatus[c.status]}>{rotuloStatus[c.status]}</Etiqueta>
                </td>
                <td className="px-4 py-3">
                  {c.saldo > 0 ? (
                    <FormularioRecebimento cobrancaId={c.id} />
                  ) : (
                    <span className="text-navy-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>

      <Cartao>
        <TituloSecao>Venda de material reciclado</TituloSecao>
        <FormularioVenda
          clientes={opcoesCliente}
          materiais={opcoesMaterial.map((m) => ({
            id: m.id,
            rotulo: `${m.nome} — ${formatarBRL(m.preco)}/${m.unidade === 'tonelada' ? 't' : 'm³'}`,
          }))}
        />
      </Cartao>

      <Cartao>
        <TituloSecao>Materiais</TituloSecao>
        <FormularioMaterial />
        {listaMateriais.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {listaMateriais.map((m) => (
              <li
                key={m.id}
                className="border-border-subtle text-navy-600 dark:text-navy-100 rounded-md border px-3 py-1.5 text-sm"
              >
                {m.nome} · {formatarBRL(m.precoUnitario)}/{m.unidade === 'tonelada' ? 't' : 'm³'}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
