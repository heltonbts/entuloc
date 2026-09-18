'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { tiposCacamba } from '@/db/schema';
import { dinheiro, erroDeZod, inteiroPositivo, type EstadoForm } from '@/server/validacao';

const esquema = z.object({
  id: z.string().min(1),
  valorLocacao: dinheiro,
  diasInclusos: inteiroPositivo,
  contagemPrazo: z.enum(['uteis', 'corridos']),
});

export async function salvarTipo(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const parsed = esquema.safeParse({
    id: form.get('id'),
    valorLocacao: form.get('valorLocacao'),
    diasInclusos: form.get('diasInclusos'),
    contagemPrazo: form.get('contagemPrazo'),
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  const { id, ...campos } = parsed.data;
  await getDb()
    .update(tiposCacamba)
    .set({ ...campos, atualizadoEm: new Date() })
    .where(eq(tiposCacamba.id, id));

  revalidatePath('/cadastros/tipos');
  return { ok: true };
}
