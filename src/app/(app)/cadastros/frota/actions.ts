'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { cacambas } from '@/db/schema';
import { violou } from '@/server/erros';
import { erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';

const esquema = z.object({
  numeracao: textoObrigatorio('Numeração'),
  tipoId: z.string().min(1, 'Escolha o tipo'),
  observacoes: z.string().trim().optional(),
});

export async function criarCacamba(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const parsed = esquema.safeParse({
    numeracao: form.get('numeracao'),
    tipoId: form.get('tipoId'),
    observacoes: form.get('observacoes') || undefined,
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  try {
    await getDb().insert(cacambas).values(parsed.data);
  } catch (erro) {
    // Numeracao repetida na frota impede saber qual unidade esta onde.
    if (violou(erro, 'cacambas_numeracao_unique')) {
      return { ok: false, erro: `Já existe uma caçamba com a numeração ${parsed.data.numeracao}.` };
    }
    throw erro;
  }

  revalidatePath('/cadastros/frota');
  return { ok: true };
}

const statusValidos = [
  'disponivel',
  'alugada',
  'aguardando_retirada',
  'manutencao',
  'inativa',
] as const;

export async function mudarStatus(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(statusValidos) })
    .safeParse({ id: form.get('id'), status: form.get('status') });
  if (!parsed.success) return erroDeZod(parsed.error);

  await getDb()
    .update(cacambas)
    .set({ status: parsed.data.status, atualizadoEm: new Date() })
    .where(eq(cacambas.id, parsed.data.id));

  revalidatePath('/cadastros/frota');
  return { ok: true };
}
