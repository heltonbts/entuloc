import type { Centavos } from './dominio/tipos';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarBRL(valor: Centavos): string {
  return BRL.format(valor / 100);
}

/** Sem o simbolo — para usar dentro de inputs. */
export function formatarValor(valor: Centavos): string {
  return (valor / 100).toFixed(2).replace('.', ',');
}

/**
 * Converte o que o usuario digitou em centavos.
 *
 * Aceita as formas que aparecem na pratica: "500", "500,00", "R$ 1.500,50",
 * "1500.50". A regra de desempate entre ponto e virgula e: se os dois
 * aparecem, o ULTIMO e o separador decimal — "1.500,50" e mil e quinhentos,
 * "1,500.50" tambem. Sozinho, ponto so e decimal se separar 1 ou 2 digitos,
 * senao e milhar ("1.500" = 150000 centavos, nao 150).
 */
export function parseCentavos(entrada: string): Centavos {
  const limpo = entrada.replace(/[^\d.,-]/g, '').trim();
  if (limpo === '' || limpo === '-') {
    throw new Error('Valor vazio');
  }

  const negativo = limpo.startsWith('-');
  const corpo = limpo.replace(/-/g, '');

  const ultimaVirgula = corpo.lastIndexOf(',');
  const ultimoPonto = corpo.lastIndexOf('.');

  let inteiro: string;
  let decimal: string;

  if (ultimaVirgula === -1 && ultimoPonto === -1) {
    inteiro = corpo;
    decimal = '';
  } else {
    const posSeparador = Math.max(ultimaVirgula, ultimoPonto);
    const candidatoDecimal = corpo.slice(posSeparador + 1);
    const temAmbos = ultimaVirgula !== -1 && ultimoPonto !== -1;

    let ehDecimal: boolean;
    if (temAmbos) {
      // "1.500,50" e "1,500.50": o ultimo separador e o decimal.
      ehDecimal = true;
    } else if (posSeparador === ultimaVirgula) {
      // Virgula sozinha em pt-BR e sempre decimal.
      ehDecimal = true;
    } else {
      // Ponto sozinho so e decimal se separar 1 ou 2 digitos: "1500.50" sim,
      // "1.500" nao (esse e milhar e vale R$ 1.500,00).
      ehDecimal = candidatoDecimal.length <= 2;
    }

    if (ehDecimal) {
      inteiro = corpo.slice(0, posSeparador);
      decimal = candidatoDecimal;
    } else {
      inteiro = corpo;
      decimal = '';
    }
  }

  inteiro = inteiro.replace(/[.,]/g, '');
  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(decimal)) {
    throw new Error(`Valor invalido: ${entrada}`);
  }

  const centavos = Number(inteiro || '0') * 100 + Number(decimal.padEnd(2, '0').slice(0, 2) || '0');
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Valor fora do limite: ${entrada}`);
  }
  return negativo ? -centavos : centavos;
}

/** Percentual digitado ("10", "10,5") para basis points. */
export function parseBps(entrada: string): number {
  const centesimos = parseCentavos(entrada); // reaproveita: 10,5 -> 1050
  return centesimos;
}

/** Basis points para texto ("1050" -> "10,5"). */
export function formatarPercentual(bps: number): string {
  return (
    (bps / 100)
      .toFixed(2)
      .replace(/\.?0+$/, '')
      .replace('.', ',') || '0'
  );
}
