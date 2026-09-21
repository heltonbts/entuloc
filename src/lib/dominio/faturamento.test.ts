import { describe, expect, it } from 'vitest';

import {
  descreverFatura,
  faltaCobrar,
  periodoDaFatura,
  periodoEncerrado,
  vencimentoDaFatura,
} from './faturamento';

describe('periodoDaFatura', () => {
  it('semana vai de segunda a domingo', () => {
    // 2026-09-23 e quarta
    expect(periodoDaFatura('2026-09-23', 'semanal')).toEqual({
      inicio: '2026-09-21',
      fim: '2026-09-27',
    });
  });

  it('domingo fecha a semana, nao abre outra', () => {
    expect(periodoDaFatura('2026-09-27', 'semanal')).toEqual({
      inicio: '2026-09-21',
      fim: '2026-09-27',
    });
  });

  it('semana que cruza o mes', () => {
    expect(periodoDaFatura('2026-10-01', 'semanal')).toEqual({
      inicio: '2026-09-28',
      fim: '2026-10-04',
    });
  });

  it('primeira quinzena 1 a 15', () => {
    expect(periodoDaFatura('2026-09-15', 'quinzenal')).toEqual({
      inicio: '2026-09-01',
      fim: '2026-09-15',
    });
  });

  it('segunda quinzena 16 ao fim do mes', () => {
    expect(periodoDaFatura('2026-09-16', 'quinzenal')).toEqual({
      inicio: '2026-09-16',
      fim: '2026-09-30',
    });
    expect(periodoDaFatura('2028-02-20', 'quinzenal').fim).toBe('2028-02-29'); // bissexto
  });

  it('mes calendario', () => {
    expect(periodoDaFatura('2026-12-31', 'mensal')).toEqual({
      inicio: '2026-12-01',
      fim: '2026-12-31',
    });
  });
});

describe('periodoEncerrado', () => {
  const p = { inicio: '2026-09-01', fim: '2026-09-15' };
  it('no ultimo dia ainda esta aberto', () => {
    expect(periodoEncerrado(p, '2026-09-15')).toBe(false);
  });
  it('no dia seguinte fecha', () => {
    expect(periodoEncerrado(p, '2026-09-16')).toBe(true);
  });
});

describe('vencimentoDaFatura', () => {
  it('fim do periodo + prazo', () => {
    expect(vencimentoDaFatura({ inicio: '2026-09-01', fim: '2026-09-30' }, 10)).toBe('2026-10-10');
  });
  it('prazo zero vence no fim do periodo', () => {
    expect(vencimentoDaFatura({ inicio: '2026-09-01', fim: '2026-09-30' }, 0)).toBe('2026-09-30');
  });
});

describe('faltaCobrar', () => {
  it('cobrado na entrega, falta so o extra', () => {
    expect(faltaCobrar(80_000, 60_000)).toBe(20_000);
  });
  it('nada cobrado ainda, cobra tudo', () => {
    expect(faltaCobrar(60_000, 0)).toBe(60_000);
  });
  it('ja cobrado a mais nao vira cobranca negativa', () => {
    expect(faltaCobrar(50_000, 60_000)).toBe(0);
  });
});

describe('descreverFatura', () => {
  it('texto da fatura', () => {
    expect(descreverFatura('quinzenal', { inicio: '2026-09-01', fim: '2026-09-15' }, 3)).toBe(
      'Fatura quinzenal 01/09 a 15/09 — 3 locação(ões)',
    );
  });
});
