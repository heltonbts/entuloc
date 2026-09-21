'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getDb } from '@/db';
import { cacambas, cidades, clientes, locacoes, tiposCacamba, usuarios } from '@/db/schema';
import { calcularVencimento } from '@/lib/dominio/prazo';
import { apurarFechamento, comandosFechamento } from '@/server/fechamento';
import { exigirPermissao } from '@/server/auth/guarda';
import { dinheiro, erroDeZod, type EstadoForm } from '@/server/validacao';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

const esquemaCriar = z.object({
  clienteId: z.uuid('Escolha o cliente'),
  cacambaId: z.uuid('Escolha a caçamba'),
  cidadeId: z.uuid('Escolha a cidade'),
  /** Vazio = entrega no endereco do cadastro do cliente. */
  enderecoEntrega: z.string().trim().optional(),
  valorFrete: dinheiro,
  observacoes: z.string().trim().optional(),
  motoristaId: z.uuid('Escolha o motorista'),
  regraMultaId: z.string().optional(),
});

export async function criarLocacao(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('locacoes.criar');

  const parsed = esquemaCriar.safeParse({
    clienteId: form.get('clienteId'),
    cacambaId: form.get('cacambaId'),
    cidadeId: form.get('cidadeId'),
    enderecoEntrega: form.get('enderecoEntrega') || undefined,
    valorFrete: form.get('valorFrete'),
    observacoes: form.get('observacoes') || undefined,
    motoristaId: form.get('motoristaId'),
    regraMultaId: form.get('regraMultaId') || undefined,
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();

  const [cliente] = await db
    .select({ endereco: clientes.endereco })
    .from(clientes)
    .where(eq(clientes.id, parsed.data.clienteId))
    .limit(1);
  if (!cliente) return { ok: false, erro: 'Cliente não encontrado.' };

  const [motorista] = await db
    .select({ ativo: usuarios.ativo })
    .from(usuarios)
    .where(eq(usuarios.id, parsed.data.motoristaId))
    .limit(1);
  if (!motorista?.ativo) return { ok: false, erro: 'Motorista inválido ou desativado.' };

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
  const [criada] = await db
    .insert(locacoes)
    .values({
      clienteId: parsed.data.clienteId,
      cacambaId: parsed.data.cacambaId,
      cidadeId: parsed.data.cidadeId,
      enderecoEntrega: parsed.data.enderecoEntrega || cliente.endereco,
      status: 'agendada',
      valorLocacao: tipo.valorLocacao,
      // O frete da cidade vem preenchido no formulario, mas pode ser ajustado
      // no lancamento (entrega mais longe, desconto combinado).
      valorFrete: parsed.data.valorFrete,
      diasContratados: tipo.diasInclusos,
      contagemPrazo: tipo.contagemPrazo,
      regraMultaId: parsed.data.regraMultaId || null,
      observacoes: parsed.data.observacoes || null,
    })
    .returning({ id: locacoes.id });

  revalidatePath('/locacoes');
  revalidatePath('/painel');
  // Toda locacao sai com a Ordem de Servico: abre direto para imprimir.
  redirect(`/os/${criada.id}`);
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
 * Fecha a locacao pelo escritorio (sem foto): apura a multa e gera a conta a
 * receber. O caminho normal e o motorista registrar a retirada em /campo.
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

  const apurado = await apurarFechamento(locacao, parsed.data.retiradaEm);

  // batch, nao db.transaction(): o driver HTTP do Neon nao suporta transacao
  // interativa ("No transactions support in neon-http driver"). O batch roda
  // tudo numa transacao unica no servidor, entao ou os passos valem ou
  // nenhum vale — fechar a locacao sem gerar a cobranca seria perder dinheiro.
  await db.batch([
    ...comandosFechamento(locacao, parsed.data.retiradaEm, apurado),
    db.update(cacambas).set({ status: 'disponivel' }).where(eq(cacambas.id, locacao.cacambaId)),
  ]);

  revalidatePath('/locacoes');
  revalidatePath('/financeiro');
  revalidatePath('/cadastros/frota');
  return { ok: true };
}

/** Passa a OS para outro motorista (ex.: folga, rota). */
export async function trocarMotorista(form: FormData): Promise<void> {
  await exigirPermissao('locacoes.criar');

  const parsed = z
    .object({ id: z.uuid(), motoristaId: z.uuid() })
    .safeParse({ id: form.get('id'), motoristaId: form.get('motoristaId') });
  if (!parsed.success) return;

  const db = getDb();
  const [motorista] = await db
    .select({ ativo: usuarios.ativo })
    .from(usuarios)
    .where(eq(usuarios.id, parsed.data.motoristaId))
    .limit(1);
  if (!motorista?.ativo) return;

  await db
    .update(locacoes)
    .set({ motoristaId: parsed.data.motoristaId, atualizadoEm: new Date() })
    .where(eq(locacoes.id, parsed.data.id));

  revalidatePath('/locacoes');
  revalidatePath('/campo');
}
