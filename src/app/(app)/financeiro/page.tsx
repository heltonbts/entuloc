import { and, asc, desc, eq, notExists } from 'drizzle-orm';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import {
  clientes,
  cobrancas,
  locacoes,
  materiais,
  recebimentos,
  registrosCampo,
  vendasMaterial,
} from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import {
  resumirCarteira,
  saldoDevedor,
  statusCobranca,
  totalRecebido,
  type StatusCobranca,
} from '@/lib/dominio/financeiro';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import { exigirPermissaoPagina } from '@/server/auth/guarda';
import { faturasPendentes } from '@/server/faturas';

import {
  FormularioMaterial,
  FormularioRecebimento,
  FormularioVenda,
  GerarFatura,
} from './formulario';

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

const rotuloOrigem = {
  locacao: 'Locação',
  venda_material: 'Venda de material',
  fatura: 'Fatura',
} as const;

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default async function PaginaFinanceiro() {
  await exigirPermissaoPagina('financeiro.ver');
  const db = getDb();
  // Fuso de Sao Paulo: em UTC, a partir das 21h a cobranca ja apareceria vencida.
  const hoje = hojeEmSaoPaulo();

  const [
    linhasCobranca,
    linhasRecebimento,
    opcoesCliente,
    opcoesMaterial,
    listaMateriais,
    faturas,
    vendasEntulho,
  ] = await Promise.all([
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
    faturasPendentes(hoje),
    // Motorista marcou "vendi o entulho" na baixa e ninguem lancou o valor ainda.
    db
      .select({
        locacaoId: locacoes.id,
        numeroOs: locacoes.numeroOs,
        cliente: clientes.nome,
        fotoId: registrosCampo.id,
        baixaEm: registrosCampo.registradoEm,
      })
      .from(locacoes)
      .innerJoin(clientes, eq(locacoes.clienteId, clientes.id))
      .leftJoin(
        registrosCampo,
        and(eq(registrosCampo.locacaoId, locacoes.id), eq(registrosCampo.etapa, 'baixa')),
      )
      .where(
        and(
          eq(locacoes.destinoEntulho, 'venda'),
          notExists(
            db
              .select({ id: vendasMaterial.id })
              .from(vendasMaterial)
              .where(eq(vendasMaterial.locacaoId, locacoes.id)),
          ),
        ),
      )
      .orderBy(asc(locacoes.numeroOs)),
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

      {faturas.length > 0 && (
        <section>
          <TituloSecao>Faturas a fechar</TituloSecao>
          <Tabela cabecalho={['Cliente', 'Período', 'Locações', 'Total', 'Vencimento', '']}>
            {faturas.map((f) => (
              <tr key={f.chave}>
                <td className="text-navy-700 px-4 py-3 font-medium dark:text-white">
                  {f.cliente}
                  <span className="text-navy-400 block text-xs capitalize">{f.tipo}</span>
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {formatarData(f.periodo.inicio)} a {formatarData(f.periodo.fim)}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                  {f.itens.map((i) => `OS ${i.numeroOs}`).join(', ')}
                </td>
                <td className="text-navy-700 px-4 py-3 font-semibold whitespace-nowrap dark:text-white">
                  {formatarBRL(f.total)}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {formatarData(f.vencimentoEm)}
                </td>
                <td className="px-4 py-3">
                  {f.encerrado ? (
                    <GerarFatura chave={f.chave} />
                  ) : (
                    <span className="text-navy-400 text-xs">
                      Período em andamento até {formatarData(f.periodo.fim)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        </section>
      )}

      {vendasEntulho.length > 0 && (
        <section>
          <TituloSecao>Vendas de entulho para lançar</TituloSecao>
          <p className="text-navy-500 dark:text-navy-200 -mt-2 mb-3 text-sm">
            O motorista vendeu o entulho na baixa. Lance comprador, quantidade e valor para virar
            cobrança.
          </p>
          <div className="flex flex-col gap-3">
            {vendasEntulho.map((v) => (
              <Cartao key={v.locacaoId}>
                <details>
                  <summary className="cursor-pointer">
                    <span className="text-navy-700 font-semibold dark:text-white">
                      OS Nº {v.numeroOs}
                    </span>
                    <span className="text-navy-500 dark:text-navy-200 text-sm">
                      {' '}
                      · caçamba de {v.cliente}
                      {v.baixaEm &&
                        ` · baixa em ${v.baixaEm.toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}`}
                    </span>
                    {v.fotoId && (
                      <a
                        href={`/fotos/${v.fotoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 ml-2 text-sm underline underline-offset-2"
                      >
                        ver foto
                      </a>
                    )}
                  </summary>
                  <div className="mt-4">
                    <FormularioVenda
                      locacaoId={v.locacaoId}
                      vendidaEm={v.baixaEm ? hojeEmSaoPaulo(v.baixaEm) : undefined}
                      clientes={opcoesCliente}
                      materiais={opcoesMaterial.map((m) => ({
                        id: m.id,
                        rotulo: `${m.nome} — ${formatarBRL(m.preco)}/${m.unidade === 'tonelada' ? 't' : 'm³'}`,
                      }))}
                    />
                  </div>
                </details>
              </Cartao>
            ))}
          </div>
        </section>
      )}

      <section>
        <TituloSecao>Contas a receber</TituloSecao>
        {itens.length === 0 ? (
          <Cartao>
            <Vazio>
              Nenhuma cobrança ainda. Elas nascem conforme a forma de cobrança de cada cliente (na
              entrega, na retirada ou em fatura) e nas vendas.
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
                  <span className="text-navy-400 block text-xs">{rotuloOrigem[c.origem]}</span>
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
