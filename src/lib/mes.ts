export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** `AAAA-MM` deslocado em `delta` meses. */
export function mesVizinho(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
