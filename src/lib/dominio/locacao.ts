import { calcularDiasAtraso } from './prazo';
import type { ContagemPrazo, DataISO, StatusLocacao } from './tipos';

/** Locacao que ainda ocupa uma cacamba do cliente. */
export const STATUS_ATIVOS: readonly StatusLocacao[] = [
  'agendada',
  'entregue',
  'retirada_solicitada',
];

/**
 * Data de hoje no fuso da operacao. `toISOString()` usa UTC e, a partir das
 * 21h no Brasil, ja devolveria o dia seguinte — contando um dia de atraso a mais.
 */
export function hojeEmSaoPaulo(agora: Date = new Date()): DataISO {
  // en-CA formata como YYYY-MM-DD.
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export type SituacaoAluguel =
  | { tipo: 'a_entregar' }
  | { tipo: 'em_dia'; diasRestantes: number }
  | { tipo: 'vence_hoje' }
  | { tipo: 'atrasada'; diasAtraso: number }
  | { tipo: 'retirada_pedida'; diasAtraso: number };

type LocacaoAtiva = {
  status: StatusLocacao;
  vencimentoEm: DataISO | null;
  retiradaSolicitadaEm: DataISO | null;
  contagemPrazo: ContagemPrazo;
};

/**
 * Como uma cacamba alugada esta hoje. Depois do pedido de retirada o atraso
 * congela na data do pedido — o resto da espera e da EntuLoc, nao do cliente.
 */
export function situacaoAluguel(locacao: LocacaoAtiva, hoje: DataISO): SituacaoAluguel {
  if (locacao.status === 'agendada' || !locacao.vencimentoEm) return { tipo: 'a_entregar' };

  if (locacao.status === 'retirada_solicitada') {
    const referencia = locacao.retiradaSolicitadaEm ?? hoje;
    return {
      tipo: 'retirada_pedida',
      diasAtraso: calcularDiasAtraso(locacao.vencimentoEm, referencia, locacao.contagemPrazo),
    };
  }

  if (locacao.vencimentoEm === hoje) return { tipo: 'vence_hoje' };
  if (locacao.vencimentoEm > hoje) {
    return {
      tipo: 'em_dia',
      diasRestantes: calcularDiasAtraso(hoje, locacao.vencimentoEm, 'corridos'),
    };
  }
  return {
    tipo: 'atrasada',
    diasAtraso: calcularDiasAtraso(locacao.vencimentoEm, hoje, locacao.contagemPrazo),
  };
}

export type EtapaCampo = 'entrega' | 'troca' | 'retirada' | 'baixa';

/**
 * O que o motorista precisa fazer agora nessa OS, ou `null` se nada.
 * A baixa so e cobrada de quem recolheu pelo app (tem foto de retirada);
 * locacao fechada pelo escritorio nao gera pendencia de baixa.
 */
export function proximaEtapa(locacao: {
  status: StatusLocacao;
  destinoEntulho: 'deposito' | 'venda' | null;
  temRetiradaNoApp: boolean;
  /** Agendada que substitui outra: entrega a vazia e recolhe a cheia de uma vez. */
  ehTroca?: boolean;
}): EtapaCampo | null {
  if (locacao.status === 'agendada') return locacao.ehTroca ? 'troca' : 'entrega';
  if (locacao.status === 'entregue' || locacao.status === 'retirada_solicitada') return 'retirada';
  if (locacao.status === 'concluida' && locacao.temRetiradaNoApp && !locacao.destinoEntulho) {
    return 'baixa';
  }
  return null;
}

/**
 * Valor sugerido para dias a mais: proporcional ao valor e ao prazo originais
 * (R$ 500 por 5 dias -> R$ 100 por dia extra). O escritorio pode ajustar.
 */
export function valorProrrogacaoSugerido(
  valorLocacao: number,
  diasContratados: number,
  diasExtras: number,
): number {
  return Math.round((valorLocacao * diasExtras) / diasContratados);
}

/** Folga para relogio de celular levemente adiantado. */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;
/** Fila offline mais velha que isso e suspeita demais para valer como data. */
const ATRASO_MAXIMO_FILA_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Qual horario vale para um registro de campo. O do celular (hora da foto)
 * e o verdadeiro quando o registro ficou na fila sem sinal — mas relogio de
 * aparelho pode estar errado, entao so e aceito dentro de uma janela plausivel.
 */
export function momentoDoRegistro(capturadoEm: Date | null, recebidoEm: Date): Date {
  if (!capturadoEm || Number.isNaN(capturadoEm.getTime())) return recebidoEm;
  const diferenca = recebidoEm.getTime() - capturadoEm.getTime();
  if (diferenca < -TOLERANCIA_FUTURO_MS || diferenca > ATRASO_MAXIMO_FILA_MS) return recebidoEm;
  return capturadoEm < recebidoEm ? capturadoEm : recebidoEm;
}
