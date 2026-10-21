import { describe, expect, it } from 'vitest';

import {
  aPagarDaDespesa,
  DIVISAO_DESPESA,
  dividirDespesa,
  resumirCarteira,
  saldoDevedor,
  statusCobranca,
  statusDespesa,
  totalDaVenda,
  totalRecebido,
  type Cobranca,
} from './financeiro';

const cobranca = (valorTotal: number, vencimentoEm: string, cancelada = false): Cobranca => ({
  valorTotal,
  vencimentoEm,
  cancelada,
});

const HOJE = '2026-09-18';

describe('saldoDevedor', () => {
  it('sem recebimento, deve tudo', () => {
    expect(saldoDevedor(cobranca(62_000, HOJE), [])).toBe(62_000);
  });

  it('desconta pagamento parcial', () => {
    expect(saldoDevedor(cobranca(62_000, HOJE), [{ valor: 20_000, recebidoEm: HOJE }])).toBe(
      42_000,
    );
  });

  it('soma varios recebimentos', () => {
    const saldo = saldoDevedor(cobranca(62_000, HOJE), [
      { valor: 20_000, recebidoEm: HOJE },
      { valor: 15_000, recebidoEm: HOJE },
      { valor: 7_000, recebidoEm: HOJE },
    ]);
    expect(saldo).toBe(20_000);
  });

  it('pagamento a maior nao vira saldo negativo', () => {
    expect(saldoDevedor(cobranca(50_000, HOJE), [{ valor: 60_000, recebidoEm: HOJE }])).toBe(0);
  });

  it('cobranca cancelada nao deve nada', () => {
    expect(saldoDevedor(cobranca(50_000, HOJE, true), [])).toBe(0);
  });
});

describe('statusCobranca', () => {
  it('aberta quando nada foi pago e nao venceu', () => {
    expect(statusCobranca(cobranca(50_000, '2026-09-30'), [], HOJE)).toBe('aberta');
  });

  it('parcial quando pagou um pedaco dentro do prazo', () => {
    const s = statusCobranca(
      cobranca(50_000, '2026-09-30'),
      [{ valor: 10_000, recebidoEm: HOJE }],
      HOJE,
    );
    expect(s).toBe('parcial');
  });

  it('paga quando quitou', () => {
    const s = statusCobranca(
      cobranca(50_000, '2026-09-30'),
      [{ valor: 50_000, recebidoEm: HOJE }],
      HOJE,
    );
    expect(s).toBe('paga');
  });

  it('nao esta vencida no proprio dia do vencimento', () => {
    expect(statusCobranca(cobranca(50_000, HOJE), [], HOJE)).toBe('aberta');
  });

  it('vencida a partir do dia seguinte', () => {
    expect(statusCobranca(cobranca(50_000, '2026-09-17'), [], HOJE)).toBe('vencida');
  });

  it('quitada no prazo continua paga mesmo depois do vencimento', () => {
    const s = statusCobranca(
      cobranca(50_000, '2026-09-10'),
      [{ valor: 50_000, recebidoEm: '2026-09-09' }],
      HOJE,
    );
    expect(s).toBe('paga');
  });

  it('cancelada ganha de tudo', () => {
    expect(statusCobranca(cobranca(50_000, '2026-01-01', true), [], HOJE)).toBe('cancelada');
  });
});

describe('resumirCarteira', () => {
  it('soma faturado, recebido, a receber e vencido', () => {
    const resumo = resumirCarteira(
      [
        {
          cobranca: cobranca(50_000, '2026-09-30'),
          recebimentos: [{ valor: 20_000, recebidoEm: HOJE }],
        },
        { cobranca: cobranca(30_000, '2026-09-10'), recebimentos: [] }, // vencida
        {
          cobranca: cobranca(10_000, '2026-09-30'),
          recebimentos: [{ valor: 10_000, recebidoEm: HOJE }],
        },
      ],
      HOJE,
    );
    expect(resumo.faturado).toBe(90_000);
    expect(resumo.recebido).toBe(30_000);
    expect(resumo.aReceber).toBe(60_000);
    expect(resumo.vencido).toBe(30_000);
    expect(resumo.quantidadeVencidas).toBe(1);
  });

  it('cancelada nao entra em nenhum total', () => {
    const resumo = resumirCarteira(
      [{ cobranca: cobranca(99_900, '2026-01-01', true), recebimentos: [] }],
      HOJE,
    );
    expect(resumo).toEqual({
      faturado: 0,
      recebido: 0,
      aReceber: 0,
      vencido: 0,
      quantidadeVencidas: 0,
    });
  });

  it('carteira vazia zera tudo', () => {
    expect(resumirCarteira([], HOJE).faturado).toBe(0);
  });
});

describe('totalDaVenda', () => {
  it('quantidade inteira', () => {
    expect(totalDaVenda(3, 8_000)).toBe(24_000); // 3 t x R$80
  });

  it('quantidade fracionada sem residuo de float', () => {
    // 2,75 * 8000 da 21999.999... em float puro.
    expect(totalDaVenda('2.750', 8_000)).toBe(22_000);
    expect(Number.isInteger(totalDaVenda('2.750', 8_000))).toBe(true);
  });

  it('arredonda para o centavo', () => {
    expect(totalDaVenda('1.333', 9_999)).toBe(13_329);
  });

  it('sempre inteiro em centavos', () => {
    for (const q of ['0.001', '1.005', '12.345', '999.999']) {
      expect(Number.isInteger(totalDaVenda(q, 7_777))).toBe(true);
    }
  });

  it('recusa quantidade invalida', () => {
    expect(() => totalDaVenda(0, 8_000)).toThrow();
    expect(() => totalDaVenda(-1, 8_000)).toThrow();
    expect(() => totalDaVenda('abc', 8_000)).toThrow();
  });
});

describe('totalRecebido', () => {
  it('soma sem perder centavo', () => {
    const r = totalRecebido([
      { valor: 33_333, recebidoEm: HOJE },
      { valor: 33_333, recebidoEm: HOJE },
      { valor: 33_334, recebidoEm: HOJE },
    ]);
    expect(r).toBe(100_000);
  });
});

describe('dividirDespesa', () => {
  it('divide em 30%, 30% e 40%, sem nada para a EntuLoc', () => {
    expect(dividirDespesa(20_000)).toEqual([6_000, 6_000, 8_000, 0]);
  });

  it('EntuLoc pagando o valor integral leva tudo na quarta parte', () => {
    expect(dividirDespesa(20_000, true)).toEqual([0, 0, 0, 20_000]);
  });

  it('a divisao soma 100%', () => {
    expect(DIVISAO_DESPESA.reduce((s, bps) => s + bps, 0)).toBe(10_000);
  });

  it('o centavo que sobra vai para a ultima parte', () => {
    expect(dividirDespesa(10_001)).toEqual([3_000, 3_000, 4_001, 0]);
    expect(dividirDespesa(1)).toEqual([0, 0, 1, 0]);
  });

  it('as partes sempre somam o valor', () => {
    for (const valor of [1, 7, 99, 3_333, 12_345, 99_999, 1_000_001]) {
      for (const integral of [false, true]) {
        const partes = dividirDespesa(valor, integral);
        expect(partes.reduce((s, p) => s + p, 0)).toBe(valor);
        expect(partes.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
      }
    }
  });
});

describe('baixa das partes da despesa', () => {
  const partes = (...pagas: (string | null)[]) =>
    [6_000, 6_000, 8_000].map((valor, i) => ({ valor, pagaEm: pagas[i] ?? null }));

  it('sem baixa, falta tudo e esta em aberto', () => {
    expect(aPagarDaDespesa(partes())).toBe(20_000);
    expect(statusDespesa(partes(), HOJE, HOJE)).toBe('aberta');
  });

  it('baixa de uma parte deixa parcial e desconta so ela', () => {
    expect(aPagarDaDespesa(partes(null, HOJE))).toBe(14_000);
    expect(statusDespesa(partes(null, HOJE), HOJE, HOJE)).toBe('parcial');
  });

  it('paga so com as tres partes baixadas', () => {
    expect(statusDespesa(partes(HOJE, HOJE), HOJE, HOJE)).toBe('parcial');
    expect(statusDespesa(partes(HOJE, HOJE, HOJE), '2026-01-01', HOJE)).toBe('paga');
  });

  it('vence no dia seguinte ao vencimento, mesmo com parte paga', () => {
    expect(statusDespesa(partes(), '2026-09-17', HOJE)).toBe('vencida');
    expect(statusDespesa(partes(HOJE), '2026-09-17', HOJE)).toBe('vencida');
  });

  it('parte de valor zero nao precisa de baixa', () => {
    const centavo = [
      { valor: 0, pagaEm: null },
      { valor: 0, pagaEm: null },
      { valor: 1, pagaEm: HOJE },
    ];
    expect(statusDespesa(centavo, HOJE, HOJE)).toBe('paga');
  });
});
