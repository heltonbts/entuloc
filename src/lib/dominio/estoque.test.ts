import { describe, expect, it } from 'vitest';

import {
  deNumeric,
  formatarQuantidade,
  paraNumeric,
  parseQuantidade,
  podeVender,
  saldoMaterial,
} from './estoque';

describe('parseQuantidade', () => {
  it('aceita virgula, ponto e inteiro', () => {
    expect(parseQuantidade('2,750')).toBe(2750);
    expect(parseQuantidade('2.75')).toBe(2750);
    expect(parseQuantidade('3')).toBe(3000);
  });

  it('aceita negativo (ajuste de perda)', () => {
    expect(parseQuantidade('-1,5')).toBe(-1500);
  });

  it('recusa mais de 3 casas e texto', () => {
    expect(() => parseQuantidade('1,2345')).toThrow();
    expect(() => parseQuantidade('abc')).toThrow();
    expect(() => parseQuantidade('')).toThrow();
  });
});

describe('numeric do banco', () => {
  it('ida e volta sem perder precisao', () => {
    expect(paraNumeric(2750)).toBe('2.750');
    expect(deNumeric('2.750')).toBe(2750);
    expect(deNumeric(null)).toBe(0);
  });

  it('soma de decimais nao acumula erro', () => {
    const soma = [0.1, 0.2, 0.3].map((v) => deNumeric(v)).reduce((a, b) => a + b, 0);
    expect(soma).toBe(600);
  });
});

describe('formatarQuantidade', () => {
  it('no padrao brasileiro, sem zeros sobrando', () => {
    expect(formatarQuantidade(2750, 'tonelada')).toBe('2,75 t');
    expect(formatarQuantidade(4000, 'metro_cubico')).toBe('4 m³');
  });
});

describe('estoque', () => {
  it('saldo = movimentos - vendido', () => {
    expect(saldoMaterial(10_000, 2_750)).toBe(7_250);
  });

  it('so vende o que ha', () => {
    expect(podeVender(5_000, 5_000)).toBe(true);
    expect(podeVender(5_000, 5_001)).toBe(false);
    expect(podeVender(5_000, 0)).toBe(false);
  });
});
