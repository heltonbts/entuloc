import { describe, expect, it } from 'vitest';

import { calcularFechamento, calcularMulta, calcularOrcamento } from './orcamento';
import type { CidadeAtendida, RegraMulta, TipoCacamba } from './tipos';
import { podeAcessar, TIPOS_CACAMBA_PADRAO } from './tipos';

const cacamba4m3 = TIPOS_CACAMBA_PADRAO.find((t) => t.id === 'cacamba_4m3') as TipoCacamba;

const cidade: CidadeAtendida = {
  id: 'c1',
  nome: 'Juazeiro do Norte',
  uf: 'CE',
  valorFrete: 12_000, // R$ 120,00
  ativa: true,
};

describe('calcularOrcamento', () => {
  it('soma locacao e frete da cidade', () => {
    const orc = calcularOrcamento(cacamba4m3, cidade);
    expect(orc.valorLocacao).toBe(50_000);
    expect(orc.valorFrete).toBe(12_000);
    expect(orc.total).toBe(62_000);
  });

  it('recusa cidade inativa', () => {
    expect(() => calcularOrcamento(cacamba4m3, { ...cidade, ativa: false })).toThrow(
      /nao atendida/i,
    );
  });
});

describe('calcularMulta', () => {
  const percentualDiario: RegraMulta = {
    id: 'm1',
    nome: '10% ao dia',
    base: 'percentual',
    percentualBps: 1000, // 10%
    cobranca: 'por_dia',
    diasCarencia: 0,
    ativa: true,
  };

  it('aplica percentual sobre o valor da locacao, por dia', () => {
    // 10% de R$ 500 = R$ 50/dia; 3 dias = R$ 150.
    expect(calcularMulta(percentualDiario, 50_000, 3)).toBe(15_000);
  });

  it('ignora o frete no calculo do percentual', () => {
    // Mesmo com frete de R$ 120, a base continua sendo os R$ 500 da locacao.
    expect(calcularMulta(percentualDiario, 50_000, 1)).toBe(5_000);
  });

  it('nao multa sem atraso', () => {
    expect(calcularMulta(percentualDiario, 50_000, 0)).toBe(0);
  });

  it('respeita a carencia', () => {
    const comCarencia = { ...percentualDiario, diasCarencia: 2 };
    expect(calcularMulta(comCarencia, 50_000, 2)).toBe(0);
    expect(calcularMulta(comCarencia, 50_000, 3)).toBe(5_000);
  });

  it('cobranca unica nao multiplica pelos dias', () => {
    const unica = { ...percentualDiario, cobranca: 'unica' as const };
    expect(calcularMulta(unica, 50_000, 7)).toBe(5_000);
  });

  it('aplica valor fixo', () => {
    const fixa: RegraMulta = {
      id: 'm2',
      nome: 'R$ 80 por dia',
      base: 'valor_fixo',
      valorFixo: 8_000,
      cobranca: 'por_dia',
      diasCarencia: 0,
      ativa: true,
    };
    expect(calcularMulta(fixa, 50_000, 4)).toBe(32_000);
  });

  it('respeita o teto maximo', () => {
    const comTeto = { ...percentualDiario, tetoMaximo: 20_000 };
    expect(calcularMulta(comTeto, 50_000, 10)).toBe(20_000);
  });

  it('regra inativa nao multa', () => {
    expect(calcularMulta({ ...percentualDiario, ativa: false }, 50_000, 5)).toBe(0);
  });

  it('arredonda para o centavo, sem residuo de float', () => {
    const tresVirgulaUm = { ...percentualDiario, percentualBps: 310, cobranca: 'unica' as const };
    // 3,1% de R$ 333,33 = R$ 10,333... -> R$ 10,33
    const multa = calcularMulta(tresVirgulaUm, 33_333, 1);
    expect(Number.isInteger(multa)).toBe(true);
    expect(multa).toBe(1_033);
  });
});

describe('calcularFechamento', () => {
  it('soma multa ao total', () => {
    const orc = calcularOrcamento(cacamba4m3, cidade);
    const regra: RegraMulta = {
      id: 'm1',
      nome: '10% ao dia',
      base: 'percentual',
      percentualBps: 1000,
      cobranca: 'por_dia',
      diasCarencia: 0,
      ativa: true,
    };
    const fech = calcularFechamento(orc, 2, regra);
    expect(fech.multa).toBe(10_000);
    expect(fech.total).toBe(72_000); // 500 + 120 + 100
  });

  it('sem regra de multa o total e o orcamento', () => {
    const orc = calcularOrcamento(cacamba4m3, cidade);
    expect(calcularFechamento(orc, 5).total).toBe(62_000);
  });
});

describe('podeAcessar', () => {
  it('gestor configura precos e ve financeiro', () => {
    expect(podeAcessar('gestor', 'precos.editar')).toBe(true);
    expect(podeAcessar('gestor', 'financeiro.ver')).toBe(true);
  });

  it('funcionario toca a operacao mas nao mexe em preco nem multa', () => {
    expect(podeAcessar('funcionario', 'locacoes.criar')).toBe(true);
    expect(podeAcessar('funcionario', 'coletas.registrar')).toBe(true);
    expect(podeAcessar('funcionario', 'precos.editar')).toBe(false);
    expect(podeAcessar('funcionario', 'multas.editar')).toBe(false);
    expect(podeAcessar('funcionario', 'financeiro.ver')).toBe(false);
  });
});
