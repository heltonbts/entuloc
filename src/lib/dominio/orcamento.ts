import type { Centavos, CidadeAtendida, RegraMulta, TipoCacamba } from './tipos';

/** Orcamento de uma locacao: valor da cacamba + frete da cidade. */
export type Orcamento = {
  valorLocacao: Centavos;
  valorFrete: Centavos;
  total: Centavos;
};

export function calcularOrcamento(tipo: TipoCacamba, cidade: CidadeAtendida): Orcamento {
  if (!cidade.ativa) {
    throw new Error(`Cidade nao atendida: ${cidade.nome}/${cidade.uf}`);
  }
  return {
    valorLocacao: tipo.valorLocacao,
    valorFrete: cidade.valorFrete,
    total: tipo.valorLocacao + cidade.valorFrete,
  };
}

/**
 * Multa por atraso na devolucao.
 *
 * O percentual incide sobre o valor da locacao, sem o frete — o frete ja foi
 * prestado e nao tem relacao com o tempo que a cacamba ficou no cliente.
 */
export function calcularMulta(
  regra: RegraMulta,
  valorLocacao: Centavos,
  diasAtraso: number,
): Centavos {
  if (!regra.ativa) return 0;

  const diasCobrados = Math.max(0, diasAtraso - regra.diasCarencia);
  if (diasCobrados === 0) return 0;

  let unidade: Centavos;
  if (regra.base === 'percentual') {
    if (regra.percentualBps === undefined) {
      throw new Error(`Regra de multa "${regra.nome}" e percentual mas nao tem percentualBps`);
    }
    // Arredonda para o centavo mais proximo, sem float residual.
    unidade = Math.round((valorLocacao * regra.percentualBps) / 10_000);
  } else {
    if (regra.valorFixo === undefined) {
      throw new Error(`Regra de multa "${regra.nome}" e valor fixo mas nao tem valorFixo`);
    }
    unidade = regra.valorFixo;
  }

  const total = regra.cobranca === 'por_dia' ? unidade * diasCobrados : unidade;
  return regra.tetoMaximo !== undefined ? Math.min(total, regra.tetoMaximo) : total;
}

/** Fechamento da locacao: o que o cliente paga no final. */
export type Fechamento = Orcamento & {
  diasAtraso: number;
  multa: Centavos;
};

export function calcularFechamento(
  orcamento: Orcamento,
  diasAtraso: number,
  regraMulta?: RegraMulta,
): Fechamento {
  const multa = regraMulta ? calcularMulta(regraMulta, orcamento.valorLocacao, diasAtraso) : 0;
  return {
    ...orcamento,
    diasAtraso,
    multa,
    total: orcamento.valorLocacao + orcamento.valorFrete + multa,
  };
}
