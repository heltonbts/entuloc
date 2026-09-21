import { formatarData, parseData, somarDias } from './prazo';
import type { Centavos, DataISO } from './tipos';

/**
 * Faturamento por cliente.
 *
 * Cada cliente escolhe quando a locacao vira cobranca:
 * - entrega: locacao + frete na entrega; o que surgir depois (prorrogacao,
 *   multa) e cobrado na retirada;
 * - retirada: tudo numa cobranca so, quando a cacamba volta;
 * - periodo: as locacoes fechadas no periodo viram uma fatura unica.
 */

export type FormaCobranca = 'entrega' | 'retirada' | 'periodo';
export type PeriodoFatura = 'semanal' | 'quinzenal' | 'mensal';

export type Periodo = { inicio: DataISO; fim: DataISO };

/**
 * Periodo de faturamento que contem a data.
 * Semana de segunda a domingo; quinzena de 1 a 15 e de 16 ao fim do mes.
 */
export function periodoDaFatura(data: DataISO, tipo: PeriodoFatura): Periodo {
  const d = parseData(data);
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  const ultimoDoMes = new Date(Date.UTC(ano, mes + 1, 0));

  if (tipo === 'semanal') {
    const desdeSegunda = (d.getUTCDay() + 6) % 7; // domingo=0 -> 6
    const inicio = somarDias(d, -desdeSegunda);
    return { inicio: formatarData(inicio), fim: formatarData(somarDias(inicio, 6)) };
  }
  if (tipo === 'quinzenal') {
    return d.getUTCDate() <= 15
      ? {
          inicio: formatarData(new Date(Date.UTC(ano, mes, 1))),
          fim: formatarData(new Date(Date.UTC(ano, mes, 15))),
        }
      : { inicio: formatarData(new Date(Date.UTC(ano, mes, 16))), fim: formatarData(ultimoDoMes) };
  }
  return { inicio: formatarData(new Date(Date.UTC(ano, mes, 1))), fim: formatarData(ultimoDoMes) };
}

/** So fatura periodo encerrado: fatura de periodo em andamento sairia incompleta. */
export function periodoEncerrado(periodo: Periodo, hoje: DataISO): boolean {
  return periodo.fim < hoje;
}

export function vencimentoDaFatura(periodo: Periodo, prazoDias: number): DataISO {
  return formatarData(somarDias(parseData(periodo.fim), prazoDias));
}

/**
 * Quanto ainda falta cobrar de uma locacao. Regra unica para todas as formas:
 * o fechamento cobra o total menos o que ja foi cobrado — assim trocar a forma
 * de cobranca do cliente no meio de uma locacao nao cobra nada duas vezes.
 */
export function faltaCobrar(total: Centavos, jaCobrado: Centavos): Centavos {
  return Math.max(0, total - jaCobrado);
}

const rotulosPeriodo: Record<PeriodoFatura, string> = {
  semanal: 'semanal',
  quinzenal: 'quinzenal',
  mensal: 'mensal',
};

export function descreverFatura(tipo: PeriodoFatura, periodo: Periodo, quantidade: number) {
  const br = (d: DataISO) => d.split('-').reverse().slice(0, 2).join('/');
  return `Fatura ${rotulosPeriodo[tipo]} ${br(periodo.inicio)} a ${br(periodo.fim)} — ${quantidade} locação(ões)`;
}

export function rotuloFormaCobranca(forma: FormaCobranca, periodo: PeriodoFatura | null): string {
  if (forma === 'entrega') return 'Na entrega';
  if (forma === 'retirada') return 'Na retirada';
  return `Fatura ${periodo ?? ''}`.trim();
}
