'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { exigirPermissao } from '@/server/auth/guarda';
import { regrasMulta } from '@/db/schema';
import {
  dinheiro,
  erroDeZod,
  percentual,
  textoObrigatorio,
  type EstadoForm,
} from '@/server/validacao';

const comum = {
  nome: textoObrigatorio('Nome da regra'),
  cobranca: z.enum(['unica', 'por_dia']),
  diasCarencia: z.coerce.number().int().min(0, 'A carência não pode ser negativa'),
  tetoMaximo: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
};

// A base define qual campo de valor e obrigatorio — e o mesmo invariante que o
// CHECK do banco garante, validado aqui para dar mensagem decente ao usuario.
const esquema = z.discriminatedUnion('base', [
  z.object({ ...comum, base: z.literal('percentual'), percentualBps: percentual }),
  z.object({ ...comum, base: z.literal('valor_fixo'), valorFixo: dinheiro }),
]);

export async function criarRegraMulta(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('multas.editar');
  const base = form.get('base');
  const parsed = esquema.safeParse({
    nome: form.get('nome'),
    base,
    cobranca: form.get('cobranca'),
    diasCarencia: form.get('diasCarencia') || 0,
    tetoMaximo: form.get('tetoMaximo'),
    ...(base === 'percentual'
      ? { percentualBps: form.get('percentualBps') }
      : { valorFixo: form.get('valorFixo') }),
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  const { tetoMaximo, ...dados } = parsed.data;
  let teto: number | undefined;
  if (tetoMaximo) {
    const parsedTeto = dinheiro.safeParse(tetoMaximo);
    if (!parsedTeto.success) return { ok: false, campos: { tetoMaximo: 'Valor inválido' } };
    teto = parsedTeto.data;
  }

  await getDb()
    .insert(regrasMulta)
    .values({
      ...dados,
      percentualBps: 'percentualBps' in dados ? dados.percentualBps : null,
      valorFixo: 'valorFixo' in dados ? dados.valorFixo : null,
      tetoMaximo: teto ?? null,
    });

  revalidatePath('/cadastros/multas');
  return { ok: true };
}

export async function alternarRegra(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('multas.editar');
  const parsed = z
    .object({ id: z.uuid(), ativa: z.enum(['true', 'false']) })
    .safeParse({ id: form.get('id'), ativa: form.get('ativa') });
  if (!parsed.success) return erroDeZod(parsed.error);

  await getDb()
    .update(regrasMulta)
    .set({ ativa: parsed.data.ativa === 'true', atualizadoEm: new Date() })
    .where(eq(regrasMulta.id, parsed.data.id));

  revalidatePath('/cadastros/multas');
  return { ok: true };
}
