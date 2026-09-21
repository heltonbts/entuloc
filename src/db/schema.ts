import { relations } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Schema da EntuLoc.
 *
 * Valores monetarios sao `integer` em CENTAVOS e percentuais sao `integer` em
 * basis points (1% = 100). Nunca use `numeric`/float para dinheiro aqui.
 */

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

export const contagemPrazoEnum = pgEnum('contagem_prazo', ['uteis', 'corridos']);
export const statusCacambaEnum = pgEnum('status_cacamba', [
  'disponivel',
  'alugada',
  'aguardando_retirada',
  'manutencao',
  'inativa',
]);
export const baseMultaEnum = pgEnum('base_multa', ['percentual', 'valor_fixo']);
export const cobrancaMultaEnum = pgEnum('cobranca_multa', ['unica', 'por_dia']);
export const statusLocacaoEnum = pgEnum('status_locacao', [
  'orcamento',
  'agendada',
  'entregue',
  'retirada_solicitada',
  'concluida',
  'cancelada',
]);
export const papelEnum = pgEnum('papel', ['gestor', 'funcionario']);
export const tipoPessoaEnum = pgEnum('tipo_pessoa', ['fisica', 'juridica']);
export const destinoEntulhoEnum = pgEnum('destino_entulho', ['deposito', 'venda']);
export const etapaCampoEnum = pgEnum('etapa_campo', ['entrega', 'retirada', 'baixa']);

const criadoEm = timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ *
 * Catalogo: tipos de cacamba
 * ------------------------------------------------------------------ */

export const tiposCacamba = pgTable(
  'tipos_cacamba',
  {
    id: text('id').primaryKey(), // 'cacamba_4m3' | 'mini_conteiner_1_5m3'
    nome: text('nome').notNull(),
    volumeM3: numeric('volume_m3', { precision: 5, scale: 2 }).notNull(),
    valorLocacao: integer('valor_locacao').notNull(), // centavos
    diasInclusos: integer('dias_inclusos').notNull(),
    contagemPrazo: contagemPrazoEnum('contagem_prazo').notNull().default('corridos'),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm,
    atualizadoEm,
  },
  (t) => [
    check('tipos_cacamba_valor_nao_negativo', sql`${t.valorLocacao} >= 0`),
    check('tipos_cacamba_dias_positivo', sql`${t.diasInclusos} >= 1`),
  ],
);

/* ------------------------------------------------------------------ *
 * Frota
 * ------------------------------------------------------------------ */

export const cacambas = pgTable('cacambas', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Numeracao pintada na unidade. Unica na frota. */
  numeracao: text('numeracao').notNull().unique(),
  tipoId: text('tipo_id')
    .notNull()
    .references(() => tiposCacamba.id, { onDelete: 'restrict' }),
  status: statusCacambaEnum('status').notNull().default('disponivel'),
  observacoes: text('observacoes'),
  criadoEm,
  atualizadoEm,
});

/* ------------------------------------------------------------------ *
 * Cidades atendidas e frete
 * ------------------------------------------------------------------ */

export const cidades = pgTable(
  'cidades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    uf: text('uf').notNull(),
    valorFrete: integer('valor_frete').notNull(), // centavos
    ativa: boolean('ativa').notNull().default(true),
    criadoEm,
    atualizadoEm,
  },
  (t) => [
    unique('cidades_nome_uf').on(t.nome, t.uf),
    check('cidades_uf_valida', sql`char_length(${t.uf}) = 2`),
    check('cidades_frete_nao_negativo', sql`${t.valorFrete} >= 0`),
  ],
);

/* ------------------------------------------------------------------ *
 * Regras de multa
 * ------------------------------------------------------------------ */

export const regrasMulta = pgTable(
  'regras_multa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    base: baseMultaEnum('base').notNull(),
    percentualBps: integer('percentual_bps'), // 1000 = 10%
    valorFixo: integer('valor_fixo'), // centavos
    cobranca: cobrancaMultaEnum('cobranca').notNull().default('por_dia'),
    diasCarencia: integer('dias_carencia').notNull().default(0),
    tetoMaximo: integer('teto_maximo'), // centavos
    ativa: boolean('ativa').notNull().default(true),
    criadoEm,
    atualizadoEm,
  },
  (t) => [
    // Garante no banco que a regra tem o campo coerente com a base escolhida —
    // uma regra percentual sem percentual nao pode existir.
    check(
      'regras_multa_base_coerente',
      sql`(${t.base} = 'percentual' AND ${t.percentualBps} IS NOT NULL AND ${t.valorFixo} IS NULL)
       OR (${t.base} = 'valor_fixo' AND ${t.valorFixo} IS NOT NULL AND ${t.percentualBps} IS NULL)`,
    ),
    check('regras_multa_carencia_nao_negativa', sql`${t.diasCarencia} >= 0`),
  ],
);

/* ------------------------------------------------------------------ *
 * Clientes e usuarios
 * ------------------------------------------------------------------ */

export const clientes = pgTable('clientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  tipoPessoa: tipoPessoaEnum('tipo_pessoa').notNull().default('fisica'),
  /** So identifica o perfil do cliente — nao limita quantas cacambas ele aluga. */
  construtora: boolean('construtora').notNull().default(false),
  /** Endereco de cadastro (rua, numero, bairro). E o padrao de entrega da cacamba. */
  endereco: text('endereco').notNull(),
  cidade: text('cidade').notNull(),
  uf: text('uf').notNull(),
  /** CPF ou CNPJ, somente digitos. */
  documento: text('documento').unique(),
  telefone: text('telefone'),
  email: text('email'),
  criadoEm,
  atualizadoEm,
});

export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  /** scrypt: `salt:hash` em hex. Nunca guarda a senha em claro. */
  senhaHash: text('senha_hash').notNull(),
  papel: papelEnum('papel').notNull().default('funcionario'),
  ativo: boolean('ativo').notNull().default(true),
  /** Forca troca de senha no proximo acesso (usuario recem-criado). */
  precisaTrocarSenha: boolean('precisa_trocar_senha').notNull().default(true),
  /** Tentativas erradas seguidas — zera no acerto. */
  tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
  /** Enquanto no futuro, o login e recusado mesmo com a senha certa. */
  bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
  criadoEm,
  atualizadoEm,
});

/**
 * Sessoes no banco, nao JWT.
 *
 * Com JWT nao da para invalidar antes de expirar; aqui, desligar um
 * funcionario e um DELETE e o acesso cai no proximo request.
 */
export const sessoes = pgTable('sessoes', {
  /** SHA-256 do token que vai no cookie — o token cru nunca e persistido. */
  id: text('id').primaryKey(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
  criadoEm,
});

/* ------------------------------------------------------------------ *
 * Feriados (afetam o prazo em dias uteis)
 * ------------------------------------------------------------------ */

export const feriados = pgTable('feriados', {
  data: date('data').primaryKey(),
  descricao: text('descricao').notNull(),
});

/* ------------------------------------------------------------------ *
 * Locacoes
 * ------------------------------------------------------------------ */

export const locacoes = pgTable(
  'locacoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Numero da Ordem de Servico: sequencial, gerado pelo banco, nunca reaproveitado. */
    numeroOs: integer('numero_os').generatedAlwaysAsIdentity().unique(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    cacambaId: uuid('cacamba_id')
      .notNull()
      .references(() => cacambas.id, { onDelete: 'restrict' }),
    cidadeId: uuid('cidade_id')
      .notNull()
      .references(() => cidades.id, { onDelete: 'restrict' }),
    enderecoEntrega: text('endereco_entrega').notNull(),
    /** Instrucoes para a equipe, impressas na OS (ponto de referencia, onde posicionar). */
    observacoes: text('observacoes'),
    /** Funcionario que recebe a OS no celular. */
    motoristaId: uuid('motorista_id').references(() => usuarios.id, { onDelete: 'set null' }),
    /**
     * Troca: esta locacao substitui a indicada (cacamba vazia entra, a cheia
     * sai na mesma viagem).
     */
    trocaDeId: uuid('troca_de_id').references((): AnyPgColumn => locacoes.id, {
      onDelete: 'restrict',
    }),
    /** Por que a locacao foi cancelada — obrigatorio ao cancelar. */
    motivoCancelamento: text('motivo_cancelamento'),
    /** Baixa da cacamba recolhida: para onde foi o entulho. Nulo = baixa pendente. */
    destinoEntulho: destinoEntulhoEnum('destino_entulho'),
    status: statusLocacaoEnum('status').notNull().default('orcamento'),

    // Valores congelados no fechamento: reajuste futuro de tabela nao pode
    // alterar o que ja foi combinado com o cliente.
    valorLocacao: integer('valor_locacao').notNull(),
    valorFrete: integer('valor_frete').notNull(),
    diasContratados: integer('dias_contratados').notNull(),
    contagemPrazo: contagemPrazoEnum('contagem_prazo').notNull(),
    regraMultaId: uuid('regra_multa_id').references(() => regrasMulta.id, {
      onDelete: 'restrict',
    }),

    entregaEm: date('entrega_em'),
    vencimentoEm: date('vencimento_em'),
    retiradaSolicitadaEm: date('retirada_solicitada_em'),
    retiradaEm: date('retirada_em'),

    /** Multa apurada no fechamento, em centavos. */
    multaApurada: integer('multa_apurada'),

    criadoPorId: uuid('criado_por_id').references(() => usuarios.id, { onDelete: 'set null' }),
    criadoEm,
    atualizadoEm,
  },
  (t) => [
    check('locacoes_valores_nao_negativos', sql`${t.valorLocacao} >= 0 AND ${t.valorFrete} >= 0`),
    check('locacoes_dias_positivo', sql`${t.diasContratados} >= 1`),
    // Uma troca viva por locacao; a cancelada nao conta, para poder pedir de novo.
    uniqueIndex('locacoes_troca_unica')
      .on(t.trocaDeId)
      .where(sql`${t.status} <> 'cancelada'`),
    check(
      'locacoes_retirada_apos_entrega',
      sql`${t.retiradaEm} IS NULL OR ${t.entregaEm} IS NULL OR ${t.retiradaEm} >= ${t.entregaEm}`,
    ),
  ],
);

/* ------------------------------------------------------------------ *
 * Prorrogacoes
 * ------------------------------------------------------------------ */

/**
 * Dias a mais combinados com o cliente depois da entrega. O valor e congelado
 * aqui e somado na cobranca do fechamento; a locacao guarda so o vencimento novo.
 */
export const prorrogacoes = pgTable(
  'prorrogacoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locacaoId: uuid('locacao_id')
      .notNull()
      .references(() => locacoes.id, { onDelete: 'cascade' }),
    dias: integer('dias').notNull(),
    valor: integer('valor').notNull(), // centavos
    registradoPorId: uuid('registrado_por_id').references(() => usuarios.id, {
      onDelete: 'set null',
    }),
    criadoEm,
  },
  (t) => [
    check('prorrogacoes_dias_positivo', sql`${t.dias} >= 1`),
    check('prorrogacoes_valor_nao_negativo', sql`${t.valor} >= 0`),
  ],
);

/* ------------------------------------------------------------------ *
 * Registros de campo (fotos do motorista)
 * ------------------------------------------------------------------ */

/**
 * Comprovante de cada etapa feita na rua. O horario e o do SERVIDOR no envio,
 * nao o do celular — relogio de aparelho pode estar errado ou ser ajustado.
 */
export const registrosCampo = pgTable(
  'registros_campo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locacaoId: uuid('locacao_id')
      .notNull()
      .references(() => locacoes.id, { onDelete: 'cascade' }),
    etapa: etapaCampoEnum('etapa').notNull(),
    /** Caminho da foto no Vercel Blob (privado). */
    fotoPathname: text('foto_pathname').notNull(),
    /** Quando o servidor recebeu. */
    registradoEm: timestamp('registrado_em', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Quando a foto foi tirada, pelo relogio do celular. So difere de
     * `registradoEm` quando o registro ficou na fila esperando sinal.
     */
    capturadoEm: timestamp('capturado_em', { withTimezone: true }),
    /** GPS do celular, quando o motorista permite. */
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    registradoPorId: uuid('registrado_por_id').references(() => usuarios.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [unique('registros_campo_etapa_unica').on(t.locacaoId, t.etapa)],
);

/* ------------------------------------------------------------------ *
 * Relations
 * ------------------------------------------------------------------ */

export const tiposCacambaRelations = relations(tiposCacamba, ({ many }) => ({
  cacambas: many(cacambas),
}));

export const cacambasRelations = relations(cacambas, ({ one, many }) => ({
  tipo: one(tiposCacamba, { fields: [cacambas.tipoId], references: [tiposCacamba.id] }),
  locacoes: many(locacoes),
}));

export const locacoesRelations = relations(locacoes, ({ one }) => ({
  cliente: one(clientes, { fields: [locacoes.clienteId], references: [clientes.id] }),
  cacamba: one(cacambas, { fields: [locacoes.cacambaId], references: [cacambas.id] }),
  cidade: one(cidades, { fields: [locacoes.cidadeId], references: [cidades.id] }),
  regraMulta: one(regrasMulta, {
    fields: [locacoes.regraMultaId],
    references: [regrasMulta.id],
  }),
  criadoPor: one(usuarios, { fields: [locacoes.criadoPorId], references: [usuarios.id] }),
}));

/* ------------------------------------------------------------------ *
 * Financeiro
 * ------------------------------------------------------------------ */

export const unidadeMaterialEnum = pgEnum('unidade_material', ['tonelada', 'metro_cubico']);
export const formaPagamentoEnum = pgEnum('forma_pagamento', [
  'dinheiro',
  'pix',
  'boleto',
  'cartao',
  'transferencia',
]);
export const origemCobrancaEnum = pgEnum('origem_cobranca', ['locacao', 'venda_material']);

/** Materiais reciclados que a EntuLoc revende. */
export const materiais = pgTable(
  'materiais',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull().unique(),
    unidade: unidadeMaterialEnum('unidade').notNull().default('tonelada'),
    /** Preco por unidade, em centavos. */
    precoUnitario: integer('preco_unitario').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm,
    atualizadoEm,
  },
  (t) => [check('materiais_preco_nao_negativo', sql`${t.precoUnitario} >= 0`)],
);

export const vendasMaterial = pgTable(
  'vendas_material',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materiais.id, { onDelete: 'restrict' }),
    quantidade: numeric('quantidade', { precision: 12, scale: 3 }).notNull(),
    /** Congelado na venda: mudar a tabela depois nao altera venda passada. */
    precoUnitario: integer('preco_unitario').notNull(),
    valorTotal: integer('valor_total').notNull(),
    vendidaEm: date('vendida_em').notNull(),
    registradoPorId: uuid('registrado_por_id').references(() => usuarios.id, {
      onDelete: 'set null',
    }),
    criadoEm,
  },
  (t) => [
    check('vendas_quantidade_positiva', sql`${t.quantidade} > 0`),
    check('vendas_valores_nao_negativos', sql`${t.precoUnitario} >= 0 AND ${t.valorTotal} >= 0`),
  ],
);

/**
 * Conta a receber.
 *
 * Nasce do fechamento de uma locacao ou de uma venda de material. O saldo NAO
 * fica guardado aqui: e sempre `valorTotal - soma(recebimentos)`, calculado na
 * hora. Guardar saldo em coluna e convite para ele divergir dos lancamentos.
 */
export const cobrancas = pgTable(
  'cobrancas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    origem: origemCobrancaEnum('origem').notNull(),
    locacaoId: uuid('locacao_id').references(() => locacoes.id, { onDelete: 'restrict' }),
    vendaId: uuid('venda_id').references(() => vendasMaterial.id, { onDelete: 'restrict' }),
    descricao: text('descricao').notNull(),
    valorTotal: integer('valor_total').notNull(),
    vencimentoEm: date('vencimento_em').notNull(),
    cancelada: boolean('cancelada').notNull().default(false),
    criadoEm,
    atualizadoEm,
  },
  (t) => [
    check('cobrancas_valor_positivo', sql`${t.valorTotal} > 0`),
    // Uma cobranca aponta para a locacao OU para a venda que a originou —
    // nunca as duas, nunca nenhuma.
    check(
      'cobrancas_origem_coerente',
      sql`(${t.origem} = 'locacao' AND ${t.locacaoId} IS NOT NULL AND ${t.vendaId} IS NULL)
       OR (${t.origem} = 'venda_material' AND ${t.vendaId} IS NOT NULL AND ${t.locacaoId} IS NULL)`,
    ),
  ],
);

export const recebimentos = pgTable(
  'recebimentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cobrancaId: uuid('cobranca_id')
      .notNull()
      .references(() => cobrancas.id, { onDelete: 'cascade' }),
    valor: integer('valor').notNull(),
    forma: formaPagamentoEnum('forma').notNull(),
    recebidoEm: date('recebido_em').notNull(),
    observacoes: text('observacoes'),
    registradoPorId: uuid('registrado_por_id').references(() => usuarios.id, {
      onDelete: 'set null',
    }),
    criadoEm,
  },
  (t) => [check('recebimentos_valor_positivo', sql`${t.valor} > 0`)],
);

export const cobrancasRelations = relations(cobrancas, ({ one, many }) => ({
  cliente: one(clientes, { fields: [cobrancas.clienteId], references: [clientes.id] }),
  locacao: one(locacoes, { fields: [cobrancas.locacaoId], references: [locacoes.id] }),
  venda: one(vendasMaterial, { fields: [cobrancas.vendaId], references: [vendasMaterial.id] }),
  recebimentos: many(recebimentos),
}));

export const recebimentosRelations = relations(recebimentos, ({ one }) => ({
  cobranca: one(cobrancas, { fields: [recebimentos.cobrancaId], references: [cobrancas.id] }),
}));

export const vendasMaterialRelations = relations(vendasMaterial, ({ one }) => ({
  cliente: one(clientes, { fields: [vendasMaterial.clienteId], references: [clientes.id] }),
  material: one(materiais, { fields: [vendasMaterial.materialId], references: [materiais.id] }),
}));
