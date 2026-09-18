import { describe, expect, it } from 'vitest';

import {
  formatarBRL,
  formatarPercentual,
  formatarValor,
  parseBps,
  parseCentavos,
} from './dinheiro';

describe('parseCentavos', () => {
  it('numero inteiro sem separador', () => {
    expect(parseCentavos('500')).toBe(50_000);
    expect(parseCentavos('0')).toBe(0);
  });

  it('virgula como decimal (pt-BR)', () => {
    expect(parseCentavos('500,00')).toBe(50_000);
    expect(parseCentavos('500,5')).toBe(50_050);
    expect(parseCentavos('0,99')).toBe(99);
  });

  it('ignora simbolo e espacos', () => {
    expect(parseCentavos('R$ 500,00')).toBe(50_000);
    expect(parseCentavos('  R$1.234,56  ')).toBe(123_456);
  });

  it('ponto como separador de milhar, nao decimal', () => {
    // O erro classico: "1.500" virar R$ 1,50.
    expect(parseCentavos('1.500')).toBe(150_000);
    expect(parseCentavos('1.500,00')).toBe(150_000);
  });

  it('ponto como decimal quando separa ate 2 digitos e nao ha virgula', () => {
    expect(parseCentavos('1500.50')).toBe(150_050);
    expect(parseCentavos('0.99')).toBe(99);
  });

  it('formato en-US com virgula de milhar', () => {
    expect(parseCentavos('1,500.50')).toBe(150_050);
  });

  it('trunca centavos alem da segunda casa', () => {
    expect(parseCentavos('10,999')).toBe(1_099);
  });

  it('preenche decimal incompleto', () => {
    expect(parseCentavos('10,5')).toBe(1_050);
  });

  it('aceita negativo', () => {
    expect(parseCentavos('-50,00')).toBe(-5_000);
  });

  it('rejeita vazio', () => {
    expect(() => parseCentavos('')).toThrow();
    expect(() => parseCentavos('   ')).toThrow();
    expect(() => parseCentavos('abc')).toThrow();
  });

  it('nunca devolve float', () => {
    for (const entrada of ['0,01', '1,11', '33,33', '999,99', '1.234,56']) {
      expect(Number.isInteger(parseCentavos(entrada))).toBe(true);
    }
  });

  it('ida e volta com formatarValor', () => {
    for (const centavos of [0, 1, 99, 100, 50_000, 123_456]) {
      expect(parseCentavos(formatarValor(centavos))).toBe(centavos);
    }
  });
});

describe('formatarBRL', () => {
  it('formata com simbolo', () => {
    expect(formatarBRL(50_000)).toMatch(/R\$\s?500,00/);
    expect(formatarBRL(0)).toMatch(/R\$\s?0,00/);
    expect(formatarBRL(99)).toMatch(/R\$\s?0,99/);
  });
});

describe('percentual', () => {
  it('converte para basis points', () => {
    expect(parseBps('10')).toBe(1000);
    expect(parseBps('10,5')).toBe(1050);
    expect(parseBps('0,5')).toBe(50);
  });

  it('formata de volta sem zeros sobrando', () => {
    expect(formatarPercentual(1000)).toBe('10');
    expect(formatarPercentual(1050)).toBe('10,5');
    expect(formatarPercentual(50)).toBe('0,5');
  });
});
