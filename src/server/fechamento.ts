import { and, eq, sum } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';

import { getDb } from '@/db';
import { clientes, cobrancas, itensFatura, locacoes, prorrogacoes, regrasMulta } from '@/db/schema';
import { faltaCobrar } from '@/lib/dominio/faturamento';
import { calcularMulta } from '@/lib/dominio/orcamento';
import { calcularDiasAtraso } from '@/lib/dominio/prazo';
import type { DataISO, RegraMulta } from '@/lib/dominio/tipos';

type Locacao = typeof locacoes.$inferSelect;
type Comando = BatchItem<'pg'>;

async function formaDoCliente(clienteId: string) {
  const [c] = await getDb()
    .select({ forma: clientes.formaCobranca })
    .from(clientes)
    .where(eq(clientes.id, clienteId))
    .limit(1);
  return c?.forma ?? 'retirada';
}

export async function somaProrrogacoes(locacaoId: string): Promise<number> {
  const [extra] = await getDb()
    .select({ valor: sum(prorrogacoes.valor).mapWith(Number) })
    .from(prorrogacoes)
    .where(eq(prorrogacoes.locacaoId, locacaoId));
  return extra?.valor ?? 0;
}

/** Quanto da locacao ja virou cobranca: cobrancas diretas + itens de fatura. */
export async function jaCobrado(locacaoId: string): Promise<number> {
  const db = getDb();
  const [[direto], [faturado]] = await Promise.all([
    db
      .select({ valor: sum(cobrancas.valorTotal).mapWith(Number) })
      .from(cobrancas)
      .where(and(eq(cobrancas.locacaoId, locacaoId), eq(cobrancas.cancelada, false))),
    db
      .select({ valor: sum(itensFatura.valor).mapWith(Number) })
      .from(itensFatura)
      .innerJoin(cobrancas, eq(itensFatura.cobrancaId, cobrancas.id))
      .where(and(eq(itensFatura.locacaoId, locacaoId), eq(cobrancas.cancelada, false))),
  ]);
  return (direto?.valor ?? 0) + (faturado?.valor ?? 0);
}

/**
 * Cliente que paga na entrega: gera a cobranca de locacao + frete quando a
 * cacamba chega. Para as outras formas nao ha nada a fazer aqui.
 */
export async function comandosCobrancaNaEntrega(
  locacao: Locacao,
  dia: DataISO,
): Promise<Comando[]> {
  if ((await formaDoCliente(locacao.clienteId)) !== 'entrega') return [];
  const valor = faltaCobrar(locacao.valorLocacao + locacao.valorFrete, await jaCobrado(locacao.id));
  if (valor === 0) return [];
  return [
    getDb()
      .insert(cobrancas)
      .values({
        clienteId: locacao.clienteId,
        origem: 'locacao',
        locacaoId: locacao.id,
        descricao: `Locação de caçamba — OS ${locacao.numeroOs} (cobrada na entrega)`,
        valorTotal: valor,
        vencimentoEm: dia,
      }),
  ];
}

/**
 * Apura multa e total de uma locacao que esta sendo encerrada, e quanto
 * disso ainda falta cobrar.
 *
 * O atraso e contado ate o PEDIDO de retirada, nao ate a coleta efetiva — a
 * demora do caminhao e responsabilidade da EntuLoc, nao do cliente.
 */
export async function apurarFechamento(locacao: Locacao, retiradaEm: DataISO) {
  if (!locacao.vencimentoEm) throw new Error('Locação sem vencimento: entrega não registrada.');

  const referencia = locacao.retiradaSolicitadaEm ?? retiradaEm;
  const diasAtraso = calcularDiasAtraso(locacao.vencimentoEm, referencia, locacao.contagemPrazo);

  let multa = 0;
  if (locacao.regraMultaId && diasAtraso > 0) {
    const [linha] = await getDb()
      .select()
      .from(regrasMulta)
      .where(eq(regrasMulta.id, locacao.regraMultaId))
      .limit(1);
    if (linha) {
      const regra: RegraMulta = {
        id: linha.id,
        nome: linha.nome,
        base: linha.base,
        percentualBps: linha.percentualBps ?? undefined,
        valorFixo: linha.valorFixo ?? undefined,
        cobranca: linha.cobranca,
        diasCarencia: linha.diasCarencia,
        tetoMaximo: linha.tetoMaximo ?? undefined,
        ativa: linha.ativa,
      };
      multa = calcularMulta(regra, locacao.valorLocacao, diasAtraso);
    }
  }

  const [prorrogado, cobrado, forma] = await Promise.all([
    somaProrrogacoes(locacao.id),
    jaCobrado(locacao.id),
    formaDoCliente(locacao.clienteId),
  ]);
  const total = locacao.valorLocacao + locacao.valorFrete + prorrogado + multa;

  return { diasAtraso, multa, prorrogado, total, forma, aCobrar: faltaCobrar(total, cobrado) };
}

/** Comandos que encerram a locacao e cobram o que falta — rodar dentro de um batch. */
export function comandosFechamento(
  locacao: Locacao,
  retiradaEm: DataISO,
  apurado: Awaited<ReturnType<typeof apurarFechamento>>,
): [Comando, ...Comando[]] {
  const db = getDb();
  const encerrar = db
    .update(locacoes)
    .set({ status: 'concluida', retiradaEm, multaApurada: apurado.multa, atualizadoEm: new Date() })
    .where(eq(locacoes.id, locacao.id));

  // Cliente de fatura: a locacao fechada espera o fechamento do periodo.
  if (apurado.forma === 'periodo' || apurado.aCobrar === 0) return [encerrar];

  const cobradoAntes = apurado.aCobrar < apurado.total;
  return [
    encerrar,
    db.insert(cobrancas).values({
      clienteId: locacao.clienteId,
      origem: 'locacao',
      locacaoId: locacao.id,
      descricao: [
        cobradoAntes
          ? `Extras da locação — OS ${locacao.numeroOs}`
          : `Locação de caçamba — OS ${locacao.numeroOs}`,
        apurado.prorrogado > 0 && 'com prorrogação',
        apurado.multa > 0 && `${apurado.diasAtraso} dia(s) de atraso`,
      ]
        .filter(Boolean)
        .join(' · '),
      valorTotal: apurado.aCobrar,
      vencimentoEm: retiradaEm,
    }),
  ];
}
