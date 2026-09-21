'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { exigirPermissao } from '@/server/auth/guarda';
import { clientes } from '@/db/schema';
import { apenasDigitos, documentoValido } from '@/lib/documento';
import { erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';
import { violou } from '@/server/erros';

const esquema = z.object({
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
    .transform((v) => (v ? apenasDigitos(v) : undefined))
    .refine((v) => v === undefined || documentoValido(v), 'CPF ou CNPJ inválido'),
  telefone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => v === undefined || z.email().safeParse(v).success, 'E-mail inválido'),
});

export async function criarCliente(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('clientes.editar');

  const parsed = esquema.safeParse({
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
  if (!parsed.success) return erroDeZod(parsed.error);

  try {
    await getDb().insert(clientes).values(parsed.data);
  } catch (erro) {
    if (violou(erro, 'clientes_documento_unique')) {
      return { ok: false, erro: 'Já existe cliente com esse CPF/CNPJ.' };
    }
    throw erro;
  }

  revalidatePath('/clientes');
  return { ok: true };
}

export async function alternarConstrutora(form: FormData): Promise<void> {
  await exigirPermissao('clientes.editar');

  const parsed = z
    .object({ id: z.uuid(), construtora: z.enum(['sim', 'nao']) })
    .safeParse({ id: form.get('id'), construtora: form.get('construtora') });
  if (!parsed.success) return;

  await getDb()
    .update(clientes)
    .set({ construtora: parsed.data.construtora === 'sim', atualizadoEm: new Date() })
    .where(eq(clientes.id, parsed.data.id));

  revalidatePath('/clientes');
  revalidatePath('/locacoes');
}
