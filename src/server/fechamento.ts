import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { cobrancas, locacoes, regrasMulta } from '@/db/schema';
import { calcularMulta } from '@/lib/dominio/orcamento';
import { calcularDiasAtraso } from '@/lib/dominio/prazo';
import type { DataISO, RegraMulta } from '@/lib/dominio/tipos';

type Locacao = typeof locacoes.$inferSelect;

/**
 * Apura multa e total de uma locacao que esta sendo encerrada.
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

  return { diasAtraso, multa, total: locacao.valorLocacao + locacao.valorFrete + multa };
}

/** Comandos que encerram a locacao e geram a conta a receber — rodar dentro de um batch. */
export function comandosFechamento(
  locacao: Locacao,
  retiradaEm: DataISO,
  apurado: Awaited<ReturnType<typeof apurarFechamento>>,
) {
  const db = getDb();
  return [
    db
      .update(locacoes)
      .set({
        status: 'concluida',
        retiradaEm,
        multaApurada: apurado.multa,
        atualizadoEm: new Date(),
      })
      .where(eq(locacoes.id, locacao.id)),
    db.insert(cobrancas).values({
      clienteId: locacao.clienteId,
      origem: 'locacao',
      locacaoId: locacao.id,
      descricao:
        apurado.multa > 0
          ? `Locação de caçamba — OS ${locacao.numeroOs} (${apurado.diasAtraso} dia(s) de atraso)`
          : `Locação de caçamba — OS ${locacao.numeroOs}`,
      valorTotal: apurado.total,
      vencimentoEm: retiradaEm,
    }),
  ] as const;
}
