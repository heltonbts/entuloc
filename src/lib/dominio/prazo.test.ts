import { describe, expect, it } from 'vitest';

import { calcularDiasAtraso, calcularVencimento, ehDiaUtil } from './prazo';

// 2026-09-14 e uma segunda-feira.
const SEGUNDA = '2026-09-14';

describe('ehDiaUtil', () => {
  it('reconhece segunda a sexta', () => {
    expect(ehDiaUtil(SEGUNDA)).toBe(true);
    expect(ehDiaUtil('2026-09-18')).toBe(true); // sexta
  });

  it('exclui fim de semana', () => {
    expect(ehDiaUtil('2026-09-19')).toBe(false); // sabado
    expect(ehDiaUtil('2026-09-20')).toBe(false); // domingo
  });

  it('exclui feriado informado', () => {
    expect(ehDiaUtil('2026-09-07', ['2026-09-07'])).toBe(false);
  });
});

describe('calcularVencimento', () => {
  it('entrega na segunda com 5 dias uteis vence na sexta', () => {
    expect(calcularVencimento(SEGUNDA, 5, 'uteis')).toBe('2026-09-18');
  });

  it('pula o fim de semana', () => {
    // Quinta 17 + 5 dias uteis: qui(1) sex(2) seg(3) ter(4) qua(5).
    expect(calcularVencimento('2026-09-17', 5, 'uteis')).toBe('2026-09-23');
  });

  it('pula feriado no meio do prazo', () => {
    // Quarta 16 vira feriado: seg(1) ter(2) qui(3) sex(4) seg(5).
    expect(calcularVencimento(SEGUNDA, 5, 'uteis', ['2026-09-16'])).toBe('2026-09-21');
  });

  it('entrega em dia nao util so comeca a contar no proximo dia util', () => {
    // Sabado 19: seg(1) ter(2) qua(3) qui(4) sex(5).
    expect(calcularVencimento('2026-09-19', 5, 'uteis')).toBe('2026-09-25');
  });

  it('em dias corridos nao pula nada', () => {
    // O dia da entrega conta, entao 5 corridos a partir de seg 14 vence sex 18.
    expect(calcularVencimento(SEGUNDA, 5, 'corridos')).toBe('2026-09-18');
  });

  it('prazo de 1 dia vence no proprio dia da entrega', () => {
    expect(calcularVencimento(SEGUNDA, 1, 'corridos')).toBe(SEGUNDA);
    expect(calcularVencimento(SEGUNDA, 1, 'uteis')).toBe(SEGUNDA);
  });

  it('nao desloca por causa do fuso do Brasil', () => {
    expect(calcularVencimento('2026-01-01', 2, 'corridos')).toBe('2026-01-02');
    expect(calcularVencimento('2026-12-31', 2, 'corridos')).toBe('2027-01-01');
  });

  it('rejeita prazo invalido', () => {
    expect(() => calcularVencimento(SEGUNDA, 0, 'uteis')).toThrow();
    expect(() => calcularVencimento(SEGUNDA, -1, 'uteis')).toThrow();
  });
});

describe('calcularDiasAtraso', () => {
  it('nao acusa atraso antes do vencimento', () => {
    expect(calcularDiasAtraso('2026-09-18', '2026-09-17', 'uteis')).toBe(0);
    expect(calcularDiasAtraso('2026-09-18', '2026-09-18', 'uteis')).toBe(0);
  });

  it('conta apenas dias uteis de atraso', () => {
    // Venceu sexta, pedido de retirada na segunda -> 1 dia util.
    expect(calcularDiasAtraso('2026-09-18', '2026-09-21', 'uteis')).toBe(1);
  });

  it('conta dias corridos quando a locacao e corrida', () => {
    expect(calcularDiasAtraso('2026-09-18', '2026-09-21', 'corridos')).toBe(3);
  });
});
