'use server';

import { and, eq, inArray, or, sum } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getDb } from '@/db';
import {
  cacambas,
  cidades,
  clientes,
  cobrancas,
  itensFatura,
  locacoes,
  movimentosEstoque,
  prorrogacoes,
  recebimentos,
  registrosCampo,
  tiposCacamba,
  usuarios,
  vendasMaterial,
} from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import { hojeEmSaoPaulo, STATUS_ATIVOS } from '@/lib/dominio/locacao';
import { calcularVencimento } from '@/lib/dominio/prazo';
import { podeAcessar } from '@/lib/dominio/tipos';
import { violou } from '@/server/erros';
import {
  apurarFechamento,
  comandosCobrancaNaEntrega,
  comandosCorrecaoValor,
  comandosFechamento,
  jaCobrado,
  somaProrrogacoes,
} from '@/server/fechamento';
import { exigirPermissao } from '@/server/auth/guarda';
import { apagarFoto } from '@/server/fotos';
import { dinheiro, erroDeZod, inteiroPositivo, type EstadoForm } from '@/server/validacao';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

const esquemaCriar = z.object({
  clienteId: z.uuid('Escolha o cliente'),
  cacambaId: z.uuid('Escolha a caçamba'),
  cidadeId: z.uuid('Escolha a cidade'),
  /** Vazio = entrega no endereco do cadastro do cliente. */
  enderecoEntrega: z.string().trim().optional(),
  valorLocacao: dinheiro.refine((v) => v > 0, 'Informe o valor da locação'),
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
    valorLocacao: form.get('valorLocacao'),
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
  // Agendada ainda deixa a caçamba "disponivel" no cadastro; sem esta checagem
  // daria para prometer a mesma caçamba para dois clientes.
  const [reservada] = await db
    .select({ id: locacoes.id, numeroOs: locacoes.numeroOs })
    .from(locacoes)
    .where(and(eq(locacoes.cacambaId, cacamba.id), inArray(locacoes.status, [...STATUS_ATIVOS])))
    .limit(1);
  if (reservada) {
    return { ok: false, erro: `Essa caçamba já está reservada na OS Nº ${reservada.numeroOs}.` };
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
  // Valores congelados agora: reajuste futuro de tabela nao altera esta locacao.
  const [criada] = await db
    .insert(locacoes)
    .values({
      clienteId: parsed.data.clienteId,
      cacambaId: parsed.data.cacambaId,
      cidadeId: parsed.data.cidadeId,
      enderecoEntrega: parsed.data.enderecoEntrega || cliente.endereco,
      status: 'agendada',
      // Valor e frete vem preenchidos da tabela, mas podem ser negociados com
      // o cliente no lancamento (desconto, entrega mais longe).
      valorLocacao: parsed.data.valorLocacao,
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
  if (locacao.trocaDeId) {
    return { ok: false, erro: 'Troca é registrada pelo motorista em Minhas OS (duas fotos).' };
  }

  const vencimentoEm = calcularVencimento(
    parsed.data.entregaEm,
    locacao.diasContratados,
    locacao.contagemPrazo,
  );

  await db.batch([
    db
      .update(locacoes)
      .set({ status: 'entregue', entregaEm: parsed.data.entregaEm, vencimentoEm })
      .where(and(eq(locacoes.id, locacao.id), eq(locacoes.status, 'agendada'))),
    db.update(cacambas).set({ status: 'alugada' }).where(eq(cacambas.id, locacao.cacambaId)),
    ...(await comandosCobrancaNaEntrega(locacao, parsed.data.entregaEm)),
  ]);

  revalidatePath('/locacoes');
  revalidatePath('/cadastros/frota');
  revalidatePath('/financeiro');
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

/**
 * Cancela uma locacao que ainda nao saiu para entrega. Depois de entregue nao
 * se cancela: registra-se a retirada, que fecha e cobra o que foi usado.
 */
export async function cancelarLocacao(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('locacoes.criar');

  const parsed = z
    .object({
      id: z.uuid(),
      motivo: z.string().trim().min(3, 'Informe o motivo do cancelamento'),
    })
    .safeParse({ id: form.get('id'), motivo: form.get('motivo') });
  if (!parsed.success) return erroDeZod(parsed.error);

  const [cancelada] = await getDb()
    .update(locacoes)
    .set({
      status: 'cancelada',
      motivoCancelamento: parsed.data.motivo,
      atualizadoEm: new Date(),
    })
    // Condicao no proprio UPDATE: se o motorista registrar a entrega no mesmo
    // instante, o cancelamento nao passa por cima dela.
    .where(and(eq(locacoes.id, parsed.data.id), eq(locacoes.status, 'agendada')))
    .returning({ id: locacoes.id });
  if (!cancelada) {
    return { ok: false, erro: 'Só dá para cancelar antes da entrega.' };
  }

  revalidatePath('/locacoes');
  revalidatePath('/painel');
  revalidatePath('/campo');
  return { ok: true };
}

/**
 * Apaga a locacao de vez (lancamento errado, teste). So o gestor. Leva junto o
 * que nasceu dela: fotos, prorrogacoes, cobrancas, venda do entulho e entrada
 * no deposito. Recusa quando apagar deixaria dinheiro ou outra OS sem origem.
 */
export async function apagarLocacao(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('locacoes.apagar');

  const parsed = z.object({ id: z.uuid() }).safeParse({ id: form.get('id') });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [locacao] = await db
    .select()
    .from(locacoes)
    .where(eq(locacoes.id, parsed.data.id))
    .limit(1);
  if (!locacao) return { ok: false, erro: 'Locação não encontrada.' };

  const [troca] = await db
    .select({ numeroOs: locacoes.numeroOs })
    .from(locacoes)
    .where(eq(locacoes.trocaDeId, locacao.id))
    .limit(1);
  if (troca) {
    return { ok: false, erro: `Apague antes a OS Nº ${troca.numeroOs}, da troca desta caçamba.` };
  }

  const [naFatura] = await db
    .select({ id: itensFatura.id })
    .from(itensFatura)
    .where(eq(itensFatura.locacaoId, locacao.id))
    .limit(1);
  if (naFatura) return { ok: false, erro: 'Essa locação já foi cobrada numa fatura.' };

  const [venda] = await db
    .select({ id: vendasMaterial.id })
    .from(vendasMaterial)
    .where(eq(vendasMaterial.locacaoId, locacao.id))
    .limit(1);
  const origemCobranca = venda
    ? or(eq(cobrancas.locacaoId, locacao.id), eq(cobrancas.vendaId, venda.id))
    : eq(cobrancas.locacaoId, locacao.id);

  const [pago] = await db
    .select({ id: recebimentos.id })
    .from(recebimentos)
    .innerJoin(cobrancas, eq(recebimentos.cobrancaId, cobrancas.id))
    .where(origemCobranca)
    .limit(1);
  if (pago) {
    return { ok: false, erro: 'Essa locação já tem pagamento recebido — não dá para apagar.' };
  }

  const fotos = await db
    .select({ pathname: registrosCampo.fotoPathname })
    .from(registrosCampo)
    .where(eq(registrosCampo.locacaoId, locacao.id));

  // A caçamba so volta para o patio se ainda estava com o cliente por esta OS.
  const noCliente = locacao.status === 'entregue' || locacao.status === 'retirada_solicitada';

  await db.batch([
    db.delete(cobrancas).where(origemCobranca),
    db.delete(vendasMaterial).where(eq(vendasMaterial.locacaoId, locacao.id)),
    db.delete(movimentosEstoque).where(eq(movimentosEstoque.locacaoId, locacao.id)),
    // Prorrogacoes e registros de campo saem em cascata.
    db.delete(locacoes).where(eq(locacoes.id, locacao.id)),
    ...(noCliente
      ? [
          db
            .update(cacambas)
            .set({ status: 'disponivel', atualizadoEm: new Date() })
            .where(eq(cacambas.id, locacao.cacambaId)),
        ]
      : []),
  ]);

  await Promise.all(fotos.map((f) => apagarFoto(f.pathname)));

  revalidatePath('/locacoes');
  revalidatePath('/painel');
  revalidatePath('/campo');
  revalidatePath('/financeiro');
  revalidatePath('/deposito');
  revalidatePath('/cadastros/frota');
  return { ok: true };
}

/** Caçamba livre de verdade: disponivel no cadastro e sem locacao ativa prometendo ela. */
async function cacambaLivre(cacambaId: string) {
  const db = getDb();
  const [cacamba] = await db
    .select({ id: cacambas.id, status: cacambas.status, tipoId: cacambas.tipoId })
    .from(cacambas)
    .where(eq(cacambas.id, cacambaId))
    .limit(1);
  if (!cacamba || cacamba.status !== 'disponivel') return null;
  const [reservada] = await db
    .select({ id: locacoes.id })
    .from(locacoes)
    .where(and(eq(locacoes.cacambaId, cacambaId), inArray(locacoes.status, [...STATUS_ATIVOS])))
    .limit(1);
  return reservada ? null : cacamba;
}

/**
 * Troca: o cliente pede uma vazia no lugar da cheia. Gera a OS da troca (nova
 * locacao, mesmo endereco e motorista) e marca a cheia como retirada pedida
 * hoje — o atraso dela para de contar no pedido, como em qualquer retirada.
 */
export async function pedirTroca(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('locacoes.criar');

  const parsed = z
    .object({
      id: z.uuid(),
      cacambaId: z.uuid('Escolha a caçamba vazia'),
      valorLocacao: dinheiro.refine((v) => v > 0, 'Informe o valor da locação'),
      valorFrete: dinheiro,
    })
    .safeParse({
      id: form.get('id'),
      cacambaId: form.get('cacambaId'),
      valorLocacao: form.get('valorLocacao'),
      valorFrete: form.get('valorFrete'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [cheia] = await db.select().from(locacoes).where(eq(locacoes.id, parsed.data.id)).limit(1);
  if (!cheia || (cheia.status !== 'entregue' && cheia.status !== 'retirada_solicitada')) {
    return { ok: false, erro: 'Só dá para trocar caçamba que está no cliente.' };
  }

  const vazia = await cacambaLivre(parsed.data.cacambaId);
  if (!vazia) return { ok: false, erro: 'Essa caçamba não está livre.' };
  const [tipo] = await db
    .select()
    .from(tiposCacamba)
    .where(eq(tiposCacamba.id, vazia.tipoId))
    .limit(1);
  if (!tipo) return { ok: false, erro: 'Tipo da caçamba inválido.' };

  let novaId: string;
  try {
    const [resultado] = await db.batch([
      db
        .insert(locacoes)
        .values({
          trocaDeId: cheia.id,
          clienteId: cheia.clienteId,
          cacambaId: vazia.id,
          cidadeId: cheia.cidadeId,
          enderecoEntrega: cheia.enderecoEntrega,
          observacoes: cheia.observacoes,
          motoristaId: cheia.motoristaId,
          regraMultaId: cheia.regraMultaId,
          status: 'agendada',
          valorLocacao: parsed.data.valorLocacao,
          valorFrete: parsed.data.valorFrete,
          diasContratados: tipo.diasInclusos,
          contagemPrazo: tipo.contagemPrazo,
          criadoPorId: usuario.id,
        })
        .returning({ id: locacoes.id }),
      db
        .update(locacoes)
        .set({
          status: 'retirada_solicitada',
          retiradaSolicitadaEm: cheia.retiradaSolicitadaEm ?? hojeEmSaoPaulo(),
          atualizadoEm: new Date(),
        })
        .where(eq(locacoes.id, cheia.id)),
    ]);
    novaId = resultado[0].id;
  } catch (erro) {
    if (violou(erro, 'locacoes_troca_unica')) {
      return { ok: false, erro: 'Essa caçamba já tem uma troca agendada.' };
    }
    throw erro;
  }

  revalidatePath('/locacoes');
  revalidatePath('/campo');
  revalidatePath('/painel');
  redirect(`/os/${novaId}`);
}

/**
 * Prorrogacao: dias a mais depois da entrega. O valor fica registrado e entra
 * na cobranca do fechamento; o vencimento anda na hora (e a multa com ele).
 */
export async function prorrogar(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('locacoes.criar');

  const parsed = z
    .object({ id: z.uuid(), dias: inteiroPositivo, valor: dinheiro })
    .safeParse({ id: form.get('id'), dias: form.get('dias'), valor: form.get('valor') });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [locacao] = await db
    .select()
    .from(locacoes)
    .where(eq(locacoes.id, parsed.data.id))
    .limit(1);
  if (!locacao || locacao.status !== 'entregue' || !locacao.entregaEm) {
    return { ok: false, erro: 'Só dá para prorrogar caçamba entregue e sem retirada pedida.' };
  }

  const [anteriores] = await db
    .select({ dias: sum(prorrogacoes.dias).mapWith(Number) })
    .from(prorrogacoes)
    .where(eq(prorrogacoes.locacaoId, locacao.id));
  const diasTotais = locacao.diasContratados + (anteriores?.dias ?? 0) + parsed.data.dias;
  const vencimentoEm = calcularVencimento(locacao.entregaEm, diasTotais, locacao.contagemPrazo);

  await db.batch([
    db.insert(prorrogacoes).values({
      locacaoId: locacao.id,
      dias: parsed.data.dias,
      valor: parsed.data.valor,
      registradoPorId: usuario.id,
    }),
    db
      .update(locacoes)
      .set({ vencimentoEm, atualizadoEm: new Date() })
      .where(and(eq(locacoes.id, locacao.id), eq(locacoes.status, 'entregue'))),
  ]);

  revalidatePath('/locacoes');
  revalidatePath('/painel');
  return { ok: true };
}

/**
 * Corrige valor e frete de uma locacao (preco renegociado com o cliente).
 * Funcionario corrige so locacao em andamento e sem baixar do ja cobrado; o
 * gestor corrige qualquer OS, nova ou antiga, e o Financeiro acompanha.
 */
export async function alterarValores(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('locacoes.criar');
  const corrigeTudo = podeAcessar(usuario.papel, 'locacoes.corrigirValor');

  const parsed = z
    .object({
      id: z.uuid(),
      valorLocacao: dinheiro.refine((v) => v > 0, 'Informe o valor da locação'),
      valorFrete: dinheiro,
    })
    .safeParse({
      id: form.get('id'),
      valorLocacao: form.get('valorLocacao'),
      valorFrete: form.get('valorFrete'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);
  const { valorLocacao, valorFrete } = parsed.data;

  const db = getDb();
  const [locacao] = await db
    .select()
    .from(locacoes)
    .where(eq(locacoes.id, parsed.data.id))
    .limit(1);
  if (!locacao) return { ok: false, erro: 'Locação não encontrada.' };
  if (locacao.status === 'cancelada') {
    return { ok: false, erro: 'Locação cancelada não tem valor a corrigir.' };
  }
  if (!corrigeTudo && !STATUS_ATIVOS.includes(locacao.status)) {
    return { ok: false, erro: 'Locação encerrada: só o gestor corrige o valor.' };
  }

  const novoTotal =
    valorLocacao + valorFrete + (await somaProrrogacoes(locacao.id)) + (locacao.multaApurada ?? 0);

  let financeiro: Awaited<ReturnType<typeof comandosCorrecaoValor>> = { comandos: [] };
  if (corrigeTudo) {
    financeiro = await comandosCorrecaoValor(locacao, novoTotal, hojeEmSaoPaulo());
    if ('erro' in financeiro) return { ok: false, erro: financeiro.erro };
  } else {
    // Cliente que paga na entrega pode ja ter sido cobrado: baixar abaixo
    // disso mexe no Financeiro, entao fica com o gestor. Aumentar e seguro —
    // a diferenca entra sozinha no fechamento ("cobra o que falta").
    const cobrado = await jaCobrado(locacao.id);
    if (novoTotal < cobrado) {
      return {
        ok: false,
        erro: `Já foram cobrados ${formatarBRL(cobrado)} desta locação. Para baixar, fale com o gestor.`,
      };
    }
  }

  await db.batch([
    db
      .update(locacoes)
      .set({ valorLocacao, valorFrete, atualizadoEm: new Date() })
      .where(eq(locacoes.id, locacao.id)),
    ...financeiro.comandos,
  ]);

  revalidatePath(`/clientes/${locacao.clienteId}`);
  revalidatePath(`/os/${locacao.id}`);
  revalidatePath('/locacoes');
  revalidatePath('/financeiro');
  revalidatePath('/painel');
  return { ok: true };
}
