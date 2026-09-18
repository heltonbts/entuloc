import type { ContagemPrazo, DataISO } from './tipos';

/**
 * Calculo de prazo da locacao.
 *
 * Datas circulam como `YYYY-MM-DD` e sao manipuladas em UTC de proposito:
 * usar `new Date()` local no fuso do Brasil desloca o dia em operacoes de
 * data-sem-hora e faria o vencimento cair um dia antes.
 *
 * REGRA DE CONTAGEM: o dia da entrega NAO conta. A contagem comeca no dia
 * seguinte, entao uma caçamba entregue na segunda com 5 dias uteis vence na
 * segunda seguinte.
 */

const MS_DIA = 86_400_000;

export function parseData(data: DataISO): Date {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function formatarData(data: Date): DataISO {
  return data.toISOString().slice(0, 10);
}

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * MS_DIA);
}

/** Dia util = segunda a sexta, fora dos feriados informados. */
export function ehDiaUtil(data: DataISO, feriados: readonly DataISO[] = []): boolean {
  const diaSemana = parseData(data).getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) return false;
  return !feriados.includes(data);
}

/** Ultimo dia da locacao — a partir do dia seguinte, o cliente esta em atraso. */
export function calcularVencimento(
  entregaEm: DataISO,
  dias: number,
  contagem: ContagemPrazo,
  feriados: readonly DataISO[] = [],
): DataISO {
  if (!Number.isInteger(dias) || dias < 1) {
    throw new Error('dias deve ser um inteiro maior ou igual a 1');
  }

  if (contagem === 'corridos') {
    return formatarData(somarDias(parseData(entregaEm), dias));
  }

  let cursor = parseData(entregaEm);
  let contados = 0;
  while (contados < dias) {
    cursor = somarDias(cursor, 1);
    if (ehDiaUtil(formatarData(cursor), feriados)) contados += 1;
  }
  return formatarData(cursor);
}

/**
 * Dias de atraso apos o vencimento.
 *
 * `referencia` deve ser a data em que o cliente pediu a retirada — o atraso
 * para de correr no pedido, nao na coleta efetiva, porque a demora da coleta
 * em si e responsabilidade da EntuLoc, nao do cliente.
 */
export function calcularDiasAtraso(
  vencimentoEm: DataISO,
  referencia: DataISO,
  contagem: ContagemPrazo,
  feriados: readonly DataISO[] = [],
): number {
  const vencimento = parseData(vencimentoEm);
  const fim = parseData(referencia);
  if (fim <= vencimento) return 0;

  if (contagem === 'corridos') {
    return Math.round((fim.getTime() - vencimento.getTime()) / MS_DIA);
  }

  let cursor = vencimento;
  let atraso = 0;
  while (cursor < fim) {
    cursor = somarDias(cursor, 1);
    if (ehDiaUtil(formatarData(cursor), feriados)) atraso += 1;
  }
  return atraso;
}
