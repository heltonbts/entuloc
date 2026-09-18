'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { cidades } from '@/db/schema';
import { violou } from '@/server/erros';
import { dinheiro, erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';

const esquema = z.object({
  nome: textoObrigatorio('Nome da cidade'),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'UF deve ter 2 letras'),
  valorFrete: dinheiro,
});

export async function criarCidade(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const parsed = esquema.safeParse({
    nome: form.get('nome'),
    uf: form.get('uf'),
    valorFrete: form.get('valorFrete'),
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  try {
    await getDb().insert(cidades).values(parsed.data);
  } catch (erro) {
    // A unique (nome, uf) e a defesa real contra frete duplicado na mesma
    // cidade — dois valores de frete para o mesmo lugar e ambiguidade pura.
    if (violou(erro, 'cidades_nome_uf')) {
      return { ok: false, erro: `${parsed.data.nome}/${parsed.data.uf} já está cadastrada.` };
    }
    throw erro;
  }

  revalidatePath('/cadastros/cidades');
  return { ok: true };
}

export async function alternarCidade(id: string, ativa: boolean) {
  await getDb().update(cidades).set({ ativa }).where(eq(cidades.id, id));
  revalidatePath('/cadastros/cidades');
}

export async function atualizarFrete(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const parsed = z
    .object({ id: z.uuid(), valorFrete: dinheiro })
    .safeParse({ id: form.get('id'), valorFrete: form.get('valorFrete') });
  if (!parsed.success) return erroDeZod(parsed.error);

  await getDb()
    .update(cidades)
    .set({ valorFrete: parsed.data.valorFrete })
    .where(eq(cidades.id, parsed.data.id));

  revalidatePath('/cadastros/cidades');
  return { ok: true };
}
