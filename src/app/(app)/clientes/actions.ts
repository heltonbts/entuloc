'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { clientes } from '@/db/schema';
import { apenasDigitos, documentoValido } from '@/lib/documento';
import { podeAcessar } from '@/lib/dominio/tipos';
import { exigirPermissao } from '@/server/auth/guarda';
import { violou } from '@/server/erros';
import { erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';

const esquemaCadastro = z.object({
  nome: textoObrigatorio('Nome'),
  tipoPessoa: z.enum(['fisica', 'juridica']),
  construtora: z.boolean(),
  endereco: textoObrigatorio('Endereço'),
  cidade: textoObrigatorio('Cidade'),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'UF inválida'),
  documento: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? apenasDigitos(v) : null))
    .refine((v) => v === null || documentoValido(v), 'CPF ou CNPJ inválido'),
  telefone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido'),
});

const esquemaCobranca = z
  .object({
    formaCobranca: z.enum(['entrega', 'retirada', 'periodo']),
    periodoFatura: z.enum(['semanal', 'quinzenal', 'mensal']).optional(),
    prazoPagamentoDias: z.coerce
      .number()
      .int('Informe dias inteiros')
      .min(0, 'Prazo não pode ser negativo')
      .max(120, 'Prazo máximo de 120 dias'),
  })
  .transform((c) => ({
    ...c,
    // Periodo so existe para quem e faturado por periodo (o banco tambem exige).
    periodoFatura: c.formaCobranca === 'periodo' ? (c.periodoFatura ?? 'mensal') : null,
  }));

function lerCadastro(form: FormData) {
  return esquemaCadastro.safeParse({
    nome: form.get('nome'),
    tipoPessoa: form.get('tipoPessoa'),
    construtora: form.get('construtora') === 'on',
    endereco: form.get('endereco'),
    cidade: form.get('cidade'),
    uf: form.get('uf'),
    documento: form.get('documento') || undefined,
    telefone: form.get('telefone') || undefined,
    email: form.get('email') || undefined,
  });
}

function lerCobranca(form: FormData) {
  return esquemaCobranca.safeParse({
    formaCobranca: form.get('formaCobranca') || 'retirada',
    periodoFatura: form.get('periodoFatura') || undefined,
    prazoPagamentoDias: form.get('prazoPagamentoDias') || 0,
  });
}

function erroDocumento(erro: unknown): EstadoForm | null {
  return violou(erro, 'clientes_documento_unique')
    ? { ok: false, campos: { documento: 'Já existe cliente com esse CPF/CNPJ.' } }
    : null;
}

export async function criarCliente(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('clientes.editar');

  const cadastro = lerCadastro(form);
  if (!cadastro.success) return erroDeZod(cadastro.error);

  // Forma de cobranca e decisao de dinheiro: so o gestor define. Cliente
  // cadastrado pelo funcionario nasce com o padrao (cobra na retirada).
  let cobranca = {};
  if (podeAcessar(usuario.papel, 'financeiro.registrar')) {
    const lida = lerCobranca(form);
    if (!lida.success) return erroDeZod(lida.error);
    cobranca = lida.data;
  }

  try {
    await getDb()
      .insert(clientes)
      .values({ ...cadastro.data, ...cobranca });
  } catch (erro) {
    const tratado = erroDocumento(erro);
    if (tratado) return tratado;
    throw erro;
  }

  revalidatePath('/clientes');
  return { ok: true };
}

export async function atualizarCliente(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('clientes.editar');

  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { ok: false, erro: 'Cliente inválido.' };

  const cadastro = lerCadastro(form);
  if (!cadastro.success) return erroDeZod(cadastro.error);

  let cobranca = {};
  if (podeAcessar(usuario.papel, 'financeiro.registrar')) {
    const lida = lerCobranca(form);
    if (!lida.success) return erroDeZod(lida.error);
    cobranca = lida.data;
  }

  try {
    await getDb()
      .update(clientes)
      .set({ ...cadastro.data, ...cobranca, atualizadoEm: new Date() })
      .where(eq(clientes.id, id.data));
  } catch (erro) {
    const tratado = erroDocumento(erro);
    if (tratado) return tratado;
    throw erro;
  }

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id.data}`);
  revalidatePath('/locacoes');
  revalidatePath('/financeiro');
  return { ok: true };
}
