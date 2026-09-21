/**
 * Estoque do deposito.
 *
 * Quantidades circulam em MILESIMOS inteiros (2,750 t = 2750), pelo mesmo
 * motivo do dinheiro em centavos: somar 0,1 + 0,2 em float da 0,30000000000000004
 * e o estoque "some" de pouco em pouco.
 */

export type Milesimos = number;
export type Unidade = 'tonelada' | 'metro_cubico';

/** "2,750" / "2.75" / "3" -> milesimos. Lanca se nao for numero. */
export function parseQuantidade(texto: string): Milesimos {
  const limpo = texto.trim().replace(/\s/g, '');
  if (!/^-?\d+([.,]\d{1,3})?$/.test(limpo)) throw new Error('Quantidade inválida');
  return Math.round(Number(limpo.replace(',', '.')) * 1000);
}

/** Valor numeric do banco ("12.500" ou soma com mais casas) -> milesimos. */
export function deNumeric(valor: string | number | null | undefined): Milesimos {
  return valor === null || valor === undefined ? 0 : Math.round(Number(valor) * 1000);
}

/** Milesimos -> texto para a coluna numeric(12,3). */
export function paraNumeric(milesimos: Milesimos): string {
  return (milesimos / 1000).toFixed(3);
}

const simbolo: Record<Unidade, string> = { tonelada: 't', metro_cubico: 'm³' };

export function formatarQuantidade(milesimos: Milesimos, unidade: Unidade): string {
  const numero = (milesimos / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${numero} ${simbolo[unidade]}`;
}

/**
 * Saldo de um material: tudo que entrou/saiu no deposito menos o que foi
 * vendido. Venda de entulho direto da cacamba nao entra aqui — esse entulho
 * nunca passou pelo deposito.
 */
export function saldoMaterial(movimentos: Milesimos, vendido: Milesimos): Milesimos {
  return movimentos - vendido;
}

/** Venda so sai se ha estoque: estoque negativo deixa de dizer o que ha para vender. */
export function podeVender(saldo: Milesimos, quantidade: Milesimos): boolean {
  return quantidade > 0 && quantidade <= saldo;
}
