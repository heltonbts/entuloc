'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { materiais, movimentosEstoque } from '@/db/schema';
import { paraNumeric, parseQuantidade } from '@/lib/dominio/estoque';
import { exigirPermissao } from '@/server/auth/guarda';
import { erroDeZod, type EstadoForm } from '@/server/validacao';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

/** Texto do formulario -> milesimos, com mensagem de campo. */
const quantidade = (rotulo: string, { positiva }: { positiva: boolean }) =>
  z
    .string()
    .min(1, `Informe ${rotulo}`)
    .transform((texto, ctx) => {
      try {
        const q = parseQuantidade(texto);
        if (q === 0 || (positiva && q < 0)) {
          ctx.addIssue({ code: 'custom', message: `${rotulo} deve ser maior que zero` });
          return z.NEVER;
        }
        return q;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Use números, até 3 casas (ex.: 2,750)' });
        return z.NEVER;
      }
    });

const opcional = (v: FormDataEntryValue | null) => (v === null || v === '' ? undefined : v);

function revalidar() {
  revalidatePath('/deposito');
  revalidatePath('/financeiro');
}

/** Entulho que chegou por fora das cacambas da EntuLoc (terceiros, obra propria). */
export async function registrarEntrada(_e: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('deposito.registrar');

  const parsed = z
    .object({
      quantidade: quantidade('a quantidade', { positiva: true }),
      ocorridoEm: dataISO,
      observacao: z.string().trim().min(3, 'Diga de onde veio o entulho'),
    })
    .safeParse({
      quantidade: form.get('quantidade'),
      ocorridoEm: form.get('ocorridoEm'),
      observacao: form.get('observacao'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);

  await getDb()
    .insert(movimentosEstoque)
    .values({
      tipo: 'entrada_entulho',
      quantidade: paraNumeric(parsed.data.quantidade),
      ocorridoEm: parsed.data.ocorridoEm,
      observacao: parsed.data.observacao,
      registradoPorId: usuario.id,
    });

  revalidar();
  return { ok: true };
}

/**
 * Producao: entulho bruto vira material reciclado. O consumo de entulho e
 * opcional e nao trava — o volume de entrada e estimado, entao o bruto pode
 * ficar negativo ate alguem ajustar; o que nao pode ficar errado e o estoque
 * de material, que e o que se vende.
 */
export async function registrarProducao(_e: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('deposito.registrar');

  const parsed = z
    .object({
      materialId: z.uuid('Escolha o material'),
      quantidade: quantidade('a quantidade produzida', { positiva: true }),
      consumo: quantidade('o entulho consumido', { positiva: true }).optional(),
      ocorridoEm: dataISO,
      observacao: z.string().trim().optional(),
    })
    .safeParse({
      materialId: form.get('materialId'),
      quantidade: form.get('quantidade'),
      consumo: opcional(form.get('consumo')),
      ocorridoEm: form.get('ocorridoEm'),
      observacao: opcional(form.get('observacao')),
    });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [material] = await db
    .select({ id: materiais.id, ativo: materiais.ativo })
    .from(materiais)
    .where(eq(materiais.id, parsed.data.materialId))
    .limit(1);
  if (!material?.ativo) return { ok: false, erro: 'Material inválido ou inativo.' };

  const loteId = crypto.randomUUID();
  const comum = {
    loteId,
    ocorridoEm: parsed.data.ocorridoEm,
    observacao: parsed.data.observacao ?? null,
    registradoPorId: usuario.id,
  };
  await db.batch([
    db.insert(movimentosEstoque).values({
      ...comum,
      tipo: 'producao',
      materialId: material.id,
      quantidade: paraNumeric(parsed.data.quantidade),
    }),
    ...(parsed.data.consumo
      ? [
          db.insert(movimentosEstoque).values({
            ...comum,
            tipo: 'consumo_entulho' as const,
            quantidade: paraNumeric(-parsed.data.consumo),
          }),
        ]
      : []),
  ]);

  revalidar();
  return { ok: true };
}

/** Acerto de inventario (contagem, perda, umidade). So o gestor: ajuste esconde desvio. */
export async function registrarAjuste(_e: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('materiais.editar');

  const parsed = z
    .object({
      alvo: z.union([z.literal('entulho'), z.uuid()], 'Escolha o que ajustar'),
      quantidade: quantidade('a quantidade', { positiva: false }),
      ocorridoEm: dataISO,
      observacao: z.string().trim().min(3, 'Explique o motivo do ajuste'),
    })
    .safeParse({
      alvo: form.get('alvo'),
      quantidade: form.get('quantidade'),
      ocorridoEm: form.get('ocorridoEm'),
      observacao: form.get('observacao'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);

  await getDb()
    .insert(movimentosEstoque)
    .values({
      tipo: 'ajuste',
      materialId: parsed.data.alvo === 'entulho' ? null : parsed.data.alvo,
      quantidade: paraNumeric(parsed.data.quantidade),
      ocorridoEm: parsed.data.ocorridoEm,
      observacao: parsed.data.observacao,
      registradoPorId: usuario.id,
    });

  revalidar();
  return { ok: true };
}
