import type { Centavos, DataISO } from './tipos';

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
