import type { Bps, Centavos, DataISO } from './tipos';

/**
 * Regras financeiras.
 *
 * O saldo de uma cobranca NUNCA e lido de uma coluna: e sempre recalculado a
 * partir dos recebimentos. Saldo guardado diverge dos lancamentos na primeira
 * correcao manual e ninguem descobre ate a conciliacao.
 */

export type StatusCobranca = 'aberta' | 'parcial' | 'paga' | 'vencida' | 'cancelada';

export type Recebimento = {
  valor: Centavos;
  recebidoEm: DataISO;
};

export type Cobranca = {
  valorTotal: Centavos;
  vencimentoEm: DataISO;
  cancelada: boolean;
};

export function totalRecebido(recebimentos: readonly Recebimento[]): Centavos {
  return recebimentos.reduce((soma, r) => soma + r.valor, 0);
}

export function saldoDevedor(cobranca: Cobranca, recebimentos: readonly Recebimento[]): Centavos {
  if (cobranca.cancelada) return 0;
  // Nunca negativo: recebimento a mais e troco/credito, nao divida negativa.
  return Math.max(0, cobranca.valorTotal - totalRecebido(recebimentos));
}

/**
 * `hoje` entra como parametro em vez de `new Date()` interno: com relogio
 * implicito nao da para testar virada de vencimento nem reproduzir um bug.
 */
export function statusCobranca(
  cobranca: Cobranca,
  recebimentos: readonly Recebimento[],
  hoje: DataISO,
): StatusCobranca {
  if (cobranca.cancelada) return 'cancelada';

  const recebido = totalRecebido(recebimentos);
  if (recebido >= cobranca.valorTotal) return 'paga';

  // Vence NO dia: so esta vencida a partir do dia seguinte.
  if (hoje > cobranca.vencimentoEm) return 'vencida';
  return recebido > 0 ? 'parcial' : 'aberta';
}

export type ResumoFinanceiro = {
  faturado: Centavos;
  recebido: Centavos;
  aReceber: Centavos;
  vencido: Centavos;
  quantidadeVencidas: number;
};

export function resumirCarteira(
  itens: readonly { cobranca: Cobranca; recebimentos: readonly Recebimento[] }[],
  hoje: DataISO,
): ResumoFinanceiro {
  const resumo: ResumoFinanceiro = {
    faturado: 0,
    recebido: 0,
    aReceber: 0,
    vencido: 0,
    quantidadeVencidas: 0,
  };

  for (const item of itens) {
    if (item.cobranca.cancelada) continue;

    const saldo = saldoDevedor(item.cobranca, item.recebimentos);
    resumo.faturado += item.cobranca.valorTotal;
    resumo.recebido += totalRecebido(item.recebimentos);
    resumo.aReceber += saldo;

    if (statusCobranca(item.cobranca, item.recebimentos, hoje) === 'vencida') {
      resumo.vencido += saldo;
      resumo.quantidadeVencidas += 1;
    }
  }

  return resumo;
}

/**
 * Total de uma venda de material.
 *
 * A quantidade tem 3 casas (ex.: 2,750 t) e o preco e por unidade em centavos.
 * Multiplicar float por centavos gera residuo (2.75 * 8000 = 21999.999...),
 * entao a conta e feita em milesimos inteiros e arredondada no fim.
 */
export function totalDaVenda(quantidade: string | number, precoUnitario: Centavos): Centavos {
  const milesimos = Math.round(Number(quantidade) * 1000);
  if (!Number.isFinite(milesimos) || milesimos <= 0) {
    throw new Error('Quantidade inválida');
  }
  return Math.round((milesimos * precoUnitario) / 1000);
}

/**
 * Toda despesa e dividida em tres partes, em basis points (somam 100%):
 * R$ 200,00 de energia = R$ 60,00 + R$ 60,00 + R$ 80,00.
 */
export const DIVISAO_DESPESA: readonly [Bps, Bps, Bps] = [3000, 3000, 4000];

/**
 * Valor de cada parte da despesa: as tres da divisao e a quarta, da EntuLoc,
 * que fica com tudo quando ela paga o valor integral. Na divisao, as duas
 * primeiras arredondam para baixo e a terceira fica com a sobra, entao as
 * partes sempre somam o valor exato.
 */
export function dividirDespesa(
  valor: Centavos,
  integralEntuloc = false,
): [Centavos, Centavos, Centavos, Centavos] {
  if (integralEntuloc) return [0, 0, 0, valor];
  const [bps1, bps2] = DIVISAO_DESPESA;
  const parte1 = Math.floor((valor * bps1) / 10_000);
  const parte2 = Math.floor((valor * bps2) / 10_000);
  return [parte1, parte2, valor - parte1 - parte2, 0];
}

export type ParteDespesa = { valor: Centavos; pagaEm: DataISO | null };

export type StatusDespesa = 'aberta' | 'parcial' | 'paga' | 'vencida';

/** Quanto falta pagar: a soma das partes que ainda nao tiveram baixa. */
export function aPagarDaDespesa(partes: readonly ParteDespesa[]): Centavos {
  return partes.reduce((soma, p) => (p.pagaEm ? soma : soma + p.valor), 0);
}

/**
 * Situacao pela baixa de cada parte. Parte de valor zero (a quarta numa despesa
 * dividida, ou sobra de centavo da divisao) nao precisa de baixa. Vence NO dia, como as cobrancas.
 */
export function statusDespesa(
  partes: readonly ParteDespesa[],
  vencimentoEm: DataISO,
  hoje: DataISO,
): StatusDespesa {
  if (aPagarDaDespesa(partes) === 0) return 'paga';
  if (hoje > vencimentoEm) return 'vencida';
  return partes.some((p) => p.pagaEm) ? 'parcial' : 'aberta';
}
