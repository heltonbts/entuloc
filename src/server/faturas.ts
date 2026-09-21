import { and, eq, notExists, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { clientes, cobrancas, itensFatura, locacoes, prorrogacoes } from '@/db/schema';
import {
  descreverFatura,
  faltaCobrar,
  periodoDaFatura,
  periodoEncerrado,
  vencimentoDaFatura,
  type Periodo,
  type PeriodoFatura,
} from '@/lib/dominio/faturamento';
import type { DataISO } from '@/lib/dominio/tipos';

export type GrupoFatura = {
  chave: string;
  clienteId: string;
  cliente: string;
  tipo: PeriodoFatura;
  periodo: Periodo;
  encerrado: boolean;
  vencimentoEm: DataISO;
  descricao: string;
  itens: { locacaoId: string; numeroOs: number; valor: number }[];
  total: number;
};

/**
 * Locacoes fechadas de clientes com fatura por periodo que ainda nao entraram
 * em fatura nenhuma, agrupadas por cliente e periodo (pela data da retirada).
 */
export async function faturasPendentes(hoje: DataISO): Promise<GrupoFatura[]> {
  const linhas = await getDb()
    .select({
      locacaoId: locacoes.id,
      numeroOs: locacoes.numeroOs,
      retiradaEm: locacoes.retiradaEm,
      total:
        sql<number>`${locacoes.valorLocacao} + ${locacoes.valorFrete} + coalesce(${locacoes.multaApurada}, 0)
        + (select coalesce(sum(${prorrogacoes.valor}), 0) from ${prorrogacoes} where ${prorrogacoes.locacaoId} = ${locacoes.id})`.mapWith(
          Number,
        ),
      cobradoDireto: sql<number>`(select coalesce(sum(${cobrancas.valorTotal}), 0) from ${cobrancas}
        where ${cobrancas.locacaoId} = ${locacoes.id} and not ${cobrancas.cancelada})`.mapWith(
        Number,
      ),
      clienteId: clientes.id,
      cliente: clientes.nome,
      tipo: clientes.periodoFatura,
      prazo: clientes.prazoPagamentoDias,
    })
    .from(locacoes)
    .innerJoin(clientes, eq(locacoes.clienteId, clientes.id))
    .where(
      and(
        eq(locacoes.status, 'concluida'),
        eq(clientes.formaCobranca, 'periodo'),
        notExists(
          getDb()
            .select({ id: itensFatura.id })
            .from(itensFatura)
            .where(eq(itensFatura.locacaoId, locacoes.id)),
        ),
      ),
    )
    .orderBy(locacoes.retiradaEm);

  const grupos = new Map<string, GrupoFatura>();
  for (const l of linhas) {
    if (!l.tipo || !l.retiradaEm) continue;
    const valor = faltaCobrar(l.total, l.cobradoDireto);
    if (valor === 0) continue;

    const periodo = periodoDaFatura(l.retiradaEm, l.tipo);
    const chave = `${l.clienteId}|${periodo.inicio}`;
    let g = grupos.get(chave);
    if (!g) {
      g = {
        chave,
        clienteId: l.clienteId,
        cliente: l.cliente,
        tipo: l.tipo,
        periodo,
        encerrado: periodoEncerrado(periodo, hoje),
        vencimentoEm: vencimentoDaFatura(periodo, l.prazo),
        descricao: '',
        itens: [],
        total: 0,
      };
      grupos.set(chave, g);
    }
    g.itens.push({ locacaoId: l.locacaoId, numeroOs: l.numeroOs, valor });
    g.total += valor;
  }

  return [...grupos.values()].map((g) => ({
    ...g,
    descricao: descreverFatura(g.tipo, g.periodo, g.itens.length),
  }));
}
