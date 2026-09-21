/**
 * Modelo de dominio da EntuLoc.
 *
 * Dinheiro e SEMPRE representado em centavos (inteiro). Nunca use float para
 * valores monetarios — R$ 500,00 e 50000, nao 500.0.
 * Percentuais sao representados em basis points (1% = 100 bps), pelo mesmo motivo.
 */

export type Centavos = number;
export type Bps = number;

/** Data sem hora, no formato `YYYY-MM-DD`. */
export type DataISO = string;

/* ------------------------------------------------------------------ *
 * Tipos de cacamba
 * ------------------------------------------------------------------ */

export type TipoCacambaId = 'cacamba_4m3' | 'mini_conteiner_1_5m3';

/** Como o prazo de locacao e contado. */
export type ContagemPrazo = 'uteis' | 'corridos';

export type TipoCacamba = {
  id: TipoCacambaId;
  nome: string;
  volumeM3: number;
  /** Valor da locacao, sem frete. */
  valorLocacao: Centavos;
  /** Dias inclusos no valor da locacao. */
  diasInclusos: number;
  contagemPrazo: ContagemPrazo;
  ativo: boolean;
};

/**
 * Catalogo inicial. Os valores sao editaveis pelo gestor — isto e apenas o
 * ponto de partida do cadastro.
 */
export const TIPOS_CACAMBA_PADRAO: readonly TipoCacamba[] = [
  {
    id: 'cacamba_4m3',
    nome: 'Caçamba 4 m³',
    volumeM3: 4,
    valorLocacao: 50_000, // R$ 500,00
    diasInclusos: 5,
    contagemPrazo: 'corridos',
    ativo: true,
  },
  {
    id: 'mini_conteiner_1_5m3',
    nome: 'Mini contêiner 1,5 m³',
    volumeM3: 1.5,
    valorLocacao: 0, // a definir pelo gestor
    diasInclusos: 5,
    contagemPrazo: 'corridos',
    ativo: true,
  },
] as const;

/* ------------------------------------------------------------------ *
 * Unidades fisicas
 * ------------------------------------------------------------------ */

export type StatusCacamba =
  'disponivel' | 'alugada' | 'aguardando_retirada' | 'manutencao' | 'inativa';

/** Uma cacamba fisica da frota, identificada pela numeracao pintada nela. */
export type Cacamba = {
  id: string;
  /** Numeracao de identificacao da unidade. Unica na frota. */
  numeracao: string;
  tipoId: TipoCacambaId;
  status: StatusCacamba;
  observacoes?: string;
};

/* ------------------------------------------------------------------ *
 * Cidades atendidas e frete
 * ------------------------------------------------------------------ */

/**
 * O frete e cadastrado por cidade atendida — nao ha valor fixo global.
 * Cidade sem cadastro significa cidade nao atendida.
 */
export type CidadeAtendida = {
  id: string;
  nome: string;
  uf: string;
  valorFrete: Centavos;
  ativa: boolean;
};

/* ------------------------------------------------------------------ *
 * Multa por atraso na devolucao
 * ------------------------------------------------------------------ */

export type BaseMulta = 'percentual' | 'valor_fixo';
export type CobrancaMulta = 'unica' | 'por_dia';

/**
 * Regra de multa aplicada quando a cacamba passa do prazo sem pedido de
 * retirada. O gestor cadastra as regras e escolhe qual usar em cada locacao.
 */
export type RegraMulta = {
  id: string;
  nome: string;
  base: BaseMulta;
  /** Usado quando `base === 'percentual'`. Ex.: 1000 = 10% do valor da locacao. */
  percentualBps?: Bps;
  /** Usado quando `base === 'valor_fixo'`. */
  valorFixo?: Centavos;
  cobranca: CobrancaMulta;
  /** Dias de tolerancia antes de comecar a multar. */
  diasCarencia: number;
  /** Teto opcional para o total da multa. */
  tetoMaximo?: Centavos;
  ativa: boolean;
};

/* ------------------------------------------------------------------ *
 * Locacao
 * ------------------------------------------------------------------ */

export type StatusLocacao =
  'orcamento' | 'agendada' | 'entregue' | 'retirada_solicitada' | 'concluida' | 'cancelada';

export type Locacao = {
  id: string;
  clienteId: string;
  cacambaId: string;
  cidadeId: string;
  enderecoEntrega: string;
  status: StatusLocacao;

  /** Congelados no momento do fechamento — precos futuros nao alteram locacoes passadas. */
  valorLocacao: Centavos;
  valorFrete: Centavos;
  diasContratados: number;
  contagemPrazo: ContagemPrazo;
  regraMultaId?: string;

  entregaEm?: DataISO;
  /** Calculado a partir de `entregaEm` + `diasContratados`. */
  vencimentoEm?: DataISO;
  /** Quando o cliente pediu a retirada (para de contar atraso). */
  retiradaSolicitadaEm?: DataISO;
  retiradaEm?: DataISO;
};

/* ------------------------------------------------------------------ *
 * Acesso
 * ------------------------------------------------------------------ */

export type Papel = 'gestor' | 'funcionario';

export type Permissao =
  | 'configuracoes.editar'
  | 'precos.editar'
  | 'cidades.editar'
  | 'multas.editar'
  | 'usuarios.gerenciar'
  | 'financeiro.ver'
  | 'financeiro.registrar'
  | 'materiais.editar'
  | 'vendas.registrar'
  | 'locacoes.fechar'
  | 'frota.editar'
  | 'clientes.editar'
  | 'locacoes.criar'
  | 'locacoes.ver'
  | 'coletas.registrar'
  | 'deposito.registrar';

/** O gestor configura e ve dinheiro; o funcionario toca a operacao do dia. */
export const PERMISSOES_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  gestor: [
    'configuracoes.editar',
    'precos.editar',
    'cidades.editar',
    'multas.editar',
    'usuarios.gerenciar',
    'financeiro.ver',
    'financeiro.registrar',
    'materiais.editar',
    'vendas.registrar',
    'locacoes.fechar',
    'frota.editar',
    'clientes.editar',
    'locacoes.criar',
    'locacoes.ver',
    'coletas.registrar',
    'deposito.registrar',
  ],
  funcionario: [
    'vendas.registrar',
    'frota.editar',
    'clientes.editar',
    'locacoes.criar',
    'locacoes.ver',
    'coletas.registrar',
    'deposito.registrar',
  ],
} as const;

export function podeAcessar(papel: Papel, permissao: Permissao): boolean {
  return PERMISSOES_POR_PAPEL[papel].includes(permissao);
}

/** Tela inicial de cada papel: o funcionario trabalha nas OS, o gestor no painel. */
export function telaInicial(papel: Papel): '/campo' | '/painel' {
  return papel === 'funcionario' ? '/campo' : '/painel';
}
