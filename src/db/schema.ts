import { relations } from 'drizzle-orm';
import {
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
    contagemPrazo: contagemPrazoEnum('contagem_prazo').notNull().default('uteis'),
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
  papel: papelEnum('papel').notNull().default('funcionario'),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm,
  atualizadoEm,
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
    check(
      'locacoes_retirada_apos_entrega',
      sql`${t.retiradaEm} IS NULL OR ${t.entregaEm} IS NULL OR ${t.retiradaEm} >= ${t.entregaEm}`,
    ),
  ],
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
