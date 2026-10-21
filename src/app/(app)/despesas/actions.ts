'use server';

import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { despesas } from '@/db/schema';
import { dividirDespesa } from '@/lib/dominio/financeiro';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import { exigirPermissao } from '@/server/auth/guarda';
import { dinheiro, erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

export async function registrarDespesa(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('financeiro.registrar');

  const parsed = z
    .object({
      descricao: textoObrigatorio('Descrição'),
      valor: dinheiro,
      vencimentoEm: dataISO,
    })
    .safeParse({
      descricao: form.get('descricao'),
      valor: form.get('valor'),
      vencimentoEm: form.get('vencimentoEm'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);
  if (parsed.data.valor <= 0)
    return { ok: false, campos: { valor: 'Informe um valor maior que zero' } };

  const integralEntuloc = form.get('integralEntuloc') === 'on';
  const [parte1, parte2, parte3, parte4] = dividirDespesa(parsed.data.valor, integralEntuloc);
  await getDb()
    .insert(despesas)
    .values({ ...parsed.data, parte1, parte2, parte3, parte4, registradoPorId: usuario.id });

  revalidatePath('/despesas');
  return { ok: true };
}

/**
 * Corrige a despesa, inclusive trocando entre dividir em 3 e a EntuLoc pagar
 * tudo. Mudar valor ou divisao refaz as partes, o que so vale com nenhuma
 * parte paga: a baixa foi de um valor que deixaria de existir.
 */
export async function editarDespesa(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('financeiro.registrar');

  const parsed = z
    .object({
      id: z.uuid(),
      descricao: textoObrigatorio('Descrição'),
      valor: dinheiro,
      vencimentoEm: dataISO,
    })
    .safeParse({
      id: form.get('id'),
      descricao: form.get('descricao'),
      valor: form.get('valor'),
      vencimentoEm: form.get('vencimentoEm'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);
  if (parsed.data.valor <= 0)
    return { ok: false, campos: { valor: 'Informe um valor maior que zero' } };

  const { id, ...dados } = parsed.data;
  const db = getDb();
  const [atual] = await db.select().from(despesas).where(eq(despesas.id, id)).limit(1);
  if (!atual) return { ok: false, erro: 'Despesa não encontrada.' };

  const partes = dividirDespesa(dados.valor, form.get('integralEntuloc') === 'on');
  const [parte1, parte2, parte3, parte4] = partes;
  const antes = [atual.parte1, atual.parte2, atual.parte3, atual.parte4];
  const mudouDivisao = partes.some((valor, i) => valor !== antes[i]);
  const semBaixa = and(
    isNull(despesas.parte1PagaEm),
    isNull(despesas.parte2PagaEm),
    isNull(despesas.parte3PagaEm),
    isNull(despesas.parte4PagaEm),
  );

  // A condicao de "nenhuma parte paga" vai no WHERE: se alguem marcar uma
  // parte entre a leitura e o update, nada e alterado.
  const [salva] = await db
    .update(despesas)
    .set({ ...dados, parte1, parte2, parte3, parte4 })
    .where(and(eq(despesas.id, id), mudouDivisao ? semBaixa : undefined))
    .returning({ id: despesas.id });
  if (!salva) {
    return {
      ok: false,
      erro: 'Desmarque as partes pagas antes de mudar o valor ou a divisão.',
    };
  }

  revalidatePath('/despesas');
  return { ok: true };
}

const COLUNA_DA_PARTE = {
  '1': 'parte1PagaEm',
  '2': 'parte2PagaEm',
  '3': 'parte3PagaEm',
  '4': 'parte4PagaEm',
} as const;

/** Marca (baixa com a data de hoje) ou desmarca uma parte, independente das outras. */
export async function marcarParteDespesa(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('financeiro.registrar');

  const parsed = z
    .object({ id: z.uuid(), parte: z.enum(['1', '2', '3', '4']), paga: z.enum(['sim', 'nao']) })
    .safeParse({ id: form.get('id'), parte: form.get('parte'), paga: form.get('paga') });
  if (!parsed.success) return { ok: false, erro: 'Parte inválida.' };

  // Marcar nao sobrescreve a data de quem marcou antes (tela velha, ou duas
  // pessoas ao mesmo tempo): so preenche o que ainda esta em aberto.
  const coluna = COLUNA_DA_PARTE[parsed.data.parte];
  const paga = parsed.data.paga === 'sim';
  await getDb()
    .update(despesas)
    .set({ [coluna]: paga ? hojeEmSaoPaulo() : null })
    .where(
      and(
        eq(despesas.id, parsed.data.id),
        paga ? isNull(despesas[coluna]) : isNotNull(despesas[coluna]),
      ),
    );

  revalidatePath('/despesas');
  return { ok: true };
}

export async function apagarDespesa(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('financeiro.registrar');

  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { ok: false, erro: 'Despesa inválida.' };

  await getDb().delete(despesas).where(eq(despesas.id, id.data));

  revalidatePath('/despesas');
  return { ok: true };
}
