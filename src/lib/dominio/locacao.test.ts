import { describe, expect, it } from 'vitest';

import { hojeEmSaoPaulo, proximaEtapa, situacaoAluguel } from './locacao';

const base = {
  status: 'entregue' as const,
  vencimentoEm: '2026-09-21',
  retiradaSolicitadaEm: null,
  contagemPrazo: 'corridos' as const,
};

describe('hojeEmSaoPaulo', () => {
  it('as 22h de Brasilia ainda e o mesmo dia (ja e amanha em UTC)', () => {
    expect(hojeEmSaoPaulo(new Date('2026-09-22T01:00:00Z'))).toBe('2026-09-21');
  });
});

describe('situacaoAluguel', () => {
  it('agendada ainda nao foi entregue', () => {
    expect(
      situacaoAluguel({ ...base, status: 'agendada', vencimentoEm: null }, '2026-09-21'),
    ).toEqual({ tipo: 'a_entregar' });
  });

  it('antes do vencimento esta em dia, com os dias que faltam', () => {
    expect(situacaoAluguel(base, '2026-09-18')).toEqual({ tipo: 'em_dia', diasRestantes: 3 });
  });

  it('no dia do vencimento', () => {
    expect(situacaoAluguel(base, '2026-09-21')).toEqual({ tipo: 'vence_hoje' });
  });

  it('depois do vencimento esta atrasada', () => {
    expect(situacaoAluguel(base, '2026-09-24')).toEqual({ tipo: 'atrasada', diasAtraso: 3 });
  });

  it('com retirada pedida o atraso congela na data do pedido', () => {
    const pedida = {
      ...base,
      status: 'retirada_solicitada' as const,
      retiradaSolicitadaEm: '2026-09-23',
    };
    expect(situacaoAluguel(pedida, '2026-09-30')).toEqual({
      tipo: 'retirada_pedida',
      diasAtraso: 2,
    });
  });

  it('retirada pedida dentro do prazo nao tem atraso', () => {
    const pedida = {
      ...base,
      status: 'retirada_solicitada' as const,
      retiradaSolicitadaEm: '2026-09-20',
    };
    expect(situacaoAluguel(pedida, '2026-09-30')).toEqual({
      tipo: 'retirada_pedida',
      diasAtraso: 0,
    });
  });
});

describe('proximaEtapa', () => {
  const os = { destinoEntulho: null, temRetiradaNoApp: false };

  it('agendada -> entrega', () => {
    expect(proximaEtapa({ ...os, status: 'agendada' })).toBe('entrega');
  });

  it('no cliente -> retirada, com ou sem pedido', () => {
    expect(proximaEtapa({ ...os, status: 'entregue' })).toBe('retirada');
    expect(proximaEtapa({ ...os, status: 'retirada_solicitada' })).toBe('retirada');
  });

  it('recolhida pelo app e sem destino -> baixa', () => {
    expect(proximaEtapa({ ...os, status: 'concluida', temRetiradaNoApp: true })).toBe('baixa');
  });

  it('com baixa feita, nada a fazer', () => {
    expect(
      proximaEtapa({ status: 'concluida', temRetiradaNoApp: true, destinoEntulho: 'venda' }),
    ).toBeNull();
  });

  it('fechada pelo escritorio nao cobra baixa', () => {
    expect(proximaEtapa({ ...os, status: 'concluida' })).toBeNull();
  });

  it('cancelada, nada a fazer', () => {
    expect(proximaEtapa({ ...os, status: 'cancelada' })).toBeNull();
  });
});
