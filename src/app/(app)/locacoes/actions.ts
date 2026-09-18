'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { cacambas, cobrancas, locacoes, regrasMulta, tiposCacamba, cidades } from '@/db/schema';
import { calcularMulta } from '@/lib/dominio/orcamento';
import { calcularDiasAtraso, calcularVencimento } from '@/lib/dominio/prazo';
import type { RegraMulta } from '@/lib/dominio/tipos';
import { exigirPermissao } from '@/server/auth/guarda';
import { erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

const esquemaCriar = z.object({
  clienteId: z.uuid('Escolha o cliente'),
  cacambaId: z.uuid('Escolha a caçamba'),
  cidadeId: z.uuid('Escolha a cidade'),
  enderecoEntrega: textoObrigatorio('Endereço'),
  regraMultaId: z.string().optional(),
});

export async function criarLocacao(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('locacoes.criar');

  const parsed = esquemaCriar.safeParse({
    clienteId: form.get('clienteId'),
    cacambaId: form.get('cacambaId'),
    cidadeId: form.get('cidadeId'),
    enderecoEntrega: form.get('enderecoEntrega'),
    regraMultaId: form.get('regraMultaId') || undefined,
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();

  const [cacamba] = await db
    .select({ id: cacambas.id, status: cacambas.status, tipoId: cacambas.tipoId })
    .from(cacambas)
    .where(eq(cacambas.id, parsed.data.cacambaId))
    .limit(1);
  if (!cacamba) return { ok: false, erro: 'Caçamba não encontrada.' };
  if (cacamba.status !== 'disponivel') {
    return { ok: false, erro: 'Essa caçamba não está disponível.' };
  }

  const [tipo] = await db
    .select()
    .from(tiposCacamba)
    .where(eq(tiposCacamba.id, cacamba.tipoId))
    .limit(1);
  const [cidade] = await db
    .select()
    .from(cidades)
    .where(eq(cidades.id, parsed.data.cidadeId))
    .limit(1);

  if (!tipo || !cidade) return { ok: false, erro: 'Tipo ou cidade inválidos.' };
  if (!cidade.ativa) return { ok: false, erro: `${cidade.nome} não está sendo atendida.` };
  if (tipo.valorLocacao === 0) {
    return { ok: false, erro: `O valor de "${tipo.nome}" ainda não foi definido.` };
  }

  // Valores congelados agora: reajuste futuro de tabela nao altera esta locacao.
  await db.insert(locacoes).values({
    clienteId: parsed.data.clienteId,
    cacambaId: parsed.data.cacambaId,
    cidadeId: parsed.data.cidadeId,
    enderecoEntrega: parsed.data.enderecoEntrega,
    status: 'agendada',
    valorLocacao: tipo.valorLocacao,
    valorFrete: cidade.valorFrete,
    diasContratados: tipo.diasInclusos,
    contagemPrazo: tipo.contagemPrazo,
    regraMultaId: parsed.data.regraMultaId || null,
  });

  revalidatePath('/locacoes');
  return { ok: true };
}

export async function registrarEntrega(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('coletas.registrar');

  const parsed = z
    .object({ id: z.uuid(), entregaEm: dataISO })
    .safeParse({ id: form.get('id'), entregaEm: form.get('entregaEm') });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [locacao] = await db
    .select()
    .from(locacoes)
    .where(eq(locacoes.id, parsed.data.id))
    .limit(1);
  if (!locacao) return { ok: false, erro: 'Locação não encontrada.' };
  if (locacao.status !== 'agendada') return { ok: false, erro: 'Essa locação já foi entregue.' };

  const vencimentoEm = calcularVencimento(
    parsed.data.entregaEm,
    locacao.diasContratados,
    locacao.contagemPrazo,
  );

  await db
    .update(locacoes)
    .set({ status: 'entregue', entregaEm: parsed.data.entregaEm, vencimentoEm })
    .where(eq(locacoes.id, locacao.id));
  await db.update(cacambas).set({ status: 'alugada' }).where(eq(cacambas.id, locacao.cacambaId));

  revalidatePath('/locacoes');
  revalidatePath('/cadastros/frota');
  return { ok: true };
}

export async function solicitarRetirada(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('coletas.registrar');

  const parsed = z
    .object({ id: z.uuid(), em: dataISO })
    .safeParse({ id: form.get('id'), em: form.get('em') });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [locacao] = await db
    .select()
    .from(locacoes)
    .where(eq(locacoes.id, parsed.data.id))
    .limit(1);
  if (!locacao || locacao.status !== 'entregue') {
    return { ok: false, erro: 'Só é possível pedir retirada de locação entregue.' };
  }

  await db
    .update(locacoes)
    .set({ status: 'retirada_solicitada', retiradaSolicitadaEm: parsed.data.em })
    .where(eq(locacoes.id, locacao.id));
  await db
    .update(cacambas)
    .set({ status: 'aguardando_retirada' })
    .where(eq(cacambas.id, locacao.cacambaId));

  revalidatePath('/locacoes');
  return { ok: true };
}

/**
 * Fecha a locacao: apura a multa e gera a conta a receber.
 *
 * O atraso e contado ate o PEDIDO de retirada, nao ate a coleta efetiva — a
 * demora do caminhao e responsabilidade da EntuLoc, nao do cliente.
 */
export async function concluirLocacao(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('locacoes.fechar');

  const parsed = z
    .object({ id: z.uuid(), retiradaEm: dataISO })
    .safeParse({ id: form.get('id'), retiradaEm: form.get('retiradaEm') });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [locacao] = await db
    .select()
    .from(locacoes)
    .where(eq(locacoes.id, parsed.data.id))
    .limit(1);
  if (!locacao) return { ok: false, erro: 'Locação não encontrada.' };
  if (locacao.status === 'concluida') return { ok: false, erro: 'Locação já concluída.' };
  if (!locacao.vencimentoEm || !locacao.entregaEm) {
    return { ok: false, erro: 'Registre a entrega antes de concluir.' };
  }
  if (parsed.data.retiradaEm < locacao.entregaEm) {
    return { ok: false, erro: 'A retirada não pode ser anterior à entrega.' };
  }

  const referencia = locacao.retiradaSolicitadaEm ?? parsed.data.retiradaEm;
  const diasAtraso = calcularDiasAtraso(locacao.vencimentoEm, referencia, locacao.contagemPrazo);

  let multa = 0;
  if (locacao.regraMultaId && diasAtraso > 0) {
    const [regraLinha] = await db
      .select()
      .from(regrasMulta)
      .where(eq(regrasMulta.id, locacao.regraMultaId))
      .limit(1);
    if (regraLinha) {
      const regra: RegraMulta = {
        id: regraLinha.id,
        nome: regraLinha.nome,
        base: regraLinha.base,
        percentualBps: regraLinha.percentualBps ?? undefined,
        valorFixo: regraLinha.valorFixo ?? undefined,
        cobranca: regraLinha.cobranca,
        diasCarencia: regraLinha.diasCarencia,
        tetoMaximo: regraLinha.tetoMaximo ?? undefined,
        ativa: regraLinha.ativa,
      };
      multa = calcularMulta(regra, locacao.valorLocacao, diasAtraso);
    }
  }

  const total = locacao.valorLocacao + locacao.valorFrete + multa;

  // batch, nao db.transaction(): o driver HTTP do Neon nao suporta transacao
  // interativa ("No transactions support in neon-http driver"). O batch roda
  // tudo numa transacao unica no servidor, entao ou os tres passos valem ou
  // nenhum vale — fechar a locacao sem gerar a cobranca seria perder dinheiro.
  await db.batch([
    db
      .update(locacoes)
      .set({ status: 'concluida', retiradaEm: parsed.data.retiradaEm, multaApurada: multa })
      .where(eq(locacoes.id, locacao.id)),
    db.update(cacambas).set({ status: 'disponivel' }).where(eq(cacambas.id, locacao.cacambaId)),
    db.insert(cobrancas).values({
      clienteId: locacao.clienteId,
      origem: 'locacao',
      locacaoId: locacao.id,
      descricao:
        multa > 0 ? `Locação de caçamba (${diasAtraso} dia(s) de atraso)` : 'Locação de caçamba',
      valorTotal: total,
      vencimentoEm: parsed.data.retiradaEm,
    }),
  ]);

  revalidatePath('/locacoes');
  revalidatePath('/financeiro');
  revalidatePath('/cadastros/frota');
  return { ok: true };
}
