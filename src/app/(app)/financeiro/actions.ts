'use server';

import { eq, sum } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import {
  cobrancas,
  itensFatura,
  locacoes,
  materiais,
  recebimentos,
  vendasMaterial,
} from '@/db/schema';
import { formatarQuantidade, podeVender } from '@/lib/dominio/estoque';
import { totalDaVenda } from '@/lib/dominio/financeiro';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import { exigirPermissao } from '@/server/auth/guarda';
import { violou } from '@/server/erros';
import { saldoDoMaterial } from '@/server/estoque';
import { faturasPendentes } from '@/server/faturas';
import { dinheiro, erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

/* ------------------------- Recebimentos ------------------------- */

export async function registrarRecebimento(
  _estado: EstadoForm,
  form: FormData,
): Promise<EstadoForm> {
  const usuario = await exigirPermissao('financeiro.registrar');

  const parsed = z
    .object({
      cobrancaId: z.uuid(),
      valor: dinheiro,
      forma: z.enum(['dinheiro', 'pix', 'boleto', 'cartao', 'transferencia']),
      recebidoEm: dataISO,
    })
    .safeParse({
      cobrancaId: form.get('cobrancaId'),
      valor: form.get('valor'),
      forma: form.get('forma'),
      recebidoEm: form.get('recebidoEm'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);
  if (parsed.data.valor <= 0)
    return { ok: false, campos: { valor: 'Informe um valor maior que zero' } };

  const db = getDb();
  const [cobranca] = await db
    .select()
    .from(cobrancas)
    .where(eq(cobrancas.id, parsed.data.cobrancaId))
    .limit(1);
  if (!cobranca) return { ok: false, erro: 'Cobrança não encontrada.' };
  if (cobranca.cancelada) return { ok: false, erro: 'Essa cobrança foi cancelada.' };

  // Confere o saldo AGORA, no servidor: a tela pode estar desatualizada e dois
  // usuarios podem baixar a mesma cobranca ao mesmo tempo.
  const [agregado] = await db
    .select({ pago: sum(recebimentos.valor) })
    .from(recebimentos)
    .where(eq(recebimentos.cobrancaId, cobranca.id));
  const jaPago = Number(agregado?.pago ?? 0);
  const saldo = cobranca.valorTotal - jaPago;

  if (saldo <= 0) return { ok: false, erro: 'Essa cobrança já está quitada.' };
  if (parsed.data.valor > saldo) {
    return {
      ok: false,
      campos: { valor: `O saldo em aberto é menor que esse valor.` },
    };
  }

  await db.insert(recebimentos).values({
    cobrancaId: cobranca.id,
    valor: parsed.data.valor,
    forma: parsed.data.forma,
    recebidoEm: parsed.data.recebidoEm,
    registradoPorId: usuario.id,
  });

  revalidatePath('/financeiro');
  return { ok: true };
}

/* ------------------------- Materiais ------------------------- */

export async function criarMaterial(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('materiais.editar');

  const parsed = z
    .object({
      nome: textoObrigatorio('Nome do material'),
      unidade: z.enum(['tonelada', 'metro_cubico']),
      precoUnitario: dinheiro,
    })
    .safeParse({
      nome: form.get('nome'),
      unidade: form.get('unidade'),
      precoUnitario: form.get('precoUnitario'),
    });
  if (!parsed.success) return erroDeZod(parsed.error);

  try {
    await getDb().insert(materiais).values(parsed.data);
  } catch (erro) {
    if (violou(erro, 'materiais_nome_unique')) {
      return { ok: false, erro: `Já existe um material chamado "${parsed.data.nome}".` };
    }
    throw erro;
  }

  revalidatePath('/financeiro');
  return { ok: true };
}

/* ------------------------- Vendas ------------------------- */

export async function registrarVenda(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('vendas.registrar');

  const parsed = z
    .object({
      clienteId: z.uuid('Escolha o cliente'),
      materialId: z.uuid('Escolha o material'),
      quantidade: z.string().min(1, 'Informe a quantidade'),
      vendidaEm: dataISO,
      prazoDias: z.coerce.number().int().min(0).max(180),
      /** Venda do entulho de uma cacamba, registrada pelo motorista na baixa. */
      locacaoId: z.uuid().optional(),
    })
    .safeParse({
      clienteId: form.get('clienteId'),
      materialId: form.get('materialId'),
      quantidade: form.get('quantidade'),
      vendidaEm: form.get('vendidaEm'),
      prazoDias: form.get('prazoDias') || 0,
      locacaoId: form.get('locacaoId') || undefined,
    });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [material] = await db
    .select()
    .from(materiais)
    .where(eq(materiais.id, parsed.data.materialId))
    .limit(1);
  if (!material) return { ok: false, erro: 'Material não encontrado.' };

  const quantidade = Number(parsed.data.quantidade.replace(',', '.'));
  let valorTotal: number;
  try {
    valorTotal = totalDaVenda(quantidade, material.precoUnitario);
  } catch {
    return { ok: false, campos: { quantidade: 'Quantidade inválida' } };
  }
  if (valorTotal <= 0) return { ok: false, erro: 'O valor da venda ficou zerado.' };

  // Material do deposito so sai se ha estoque. Entulho vendido direto da
  // cacamba (locacaoId) nunca entrou no deposito, entao nao passa por aqui.
  if (!parsed.data.locacaoId) {
    const saldo = await saldoDoMaterial(material.id);
    const pedido = Math.round(quantidade * 1000);
    if (!podeVender(saldo, pedido)) {
      return {
        ok: false,
        campos: {
          quantidade: `Estoque de ${material.nome}: ${formatarQuantidade(saldo, material.unidade)}. Registre a produção ou um ajuste no Depósito.`,
        },
      };
    }
  }

  const vencimento = new Date(`${parsed.data.vendidaEm}T00:00:00Z`);
  vencimento.setUTCDate(vencimento.getUTCDate() + parsed.data.prazoDias);
  const vencimentoEm = vencimento.toISOString().slice(0, 10);

  if (parsed.data.locacaoId) {
    const [origem] = await db
      .select({ destino: locacoes.destinoEntulho })
      .from(locacoes)
      .where(eq(locacoes.id, parsed.data.locacaoId))
      .limit(1);
    if (origem?.destino !== 'venda') {
      return { ok: false, erro: 'Essa OS não teve venda de entulho registrada.' };
    }
  }

  // Id gerado aqui para a venda e a cobranca irem juntas num batch (transacao):
  // venda sem cobranca seria dinheiro que ninguem cobra.
  const vendaId = crypto.randomUUID();
  const descricao = `Venda de ${quantidade.toFixed(3)} ${material.unidade === 'tonelada' ? 't' : 'm³'} de ${material.nome}`;
  try {
    await db.batch([
      db.insert(vendasMaterial).values({
        id: vendaId,
        clienteId: parsed.data.clienteId,
        materialId: material.id,
        quantidade: quantidade.toFixed(3),
        precoUnitario: material.precoUnitario, // congelado
        valorTotal,
        vendidaEm: parsed.data.vendidaEm,
        registradoPorId: usuario.id,
        locacaoId: parsed.data.locacaoId ?? null,
      }),
      db.insert(cobrancas).values({
        clienteId: parsed.data.clienteId,
        origem: 'venda_material',
        vendaId,
        descricao,
        valorTotal,
        vencimentoEm,
      }),
    ]);
  } catch (erro) {
    if (violou(erro, 'vendas_material_locacao_id_unique')) {
      return { ok: false, erro: 'A venda do entulho dessa OS já foi lançada.' };
    }
    throw erro;
  }

  revalidatePath('/financeiro');
  revalidatePath('/deposito');
  return { ok: true };
}

/* ------------------------- Faturas ------------------------- */

/**
 * Fecha a fatura de um cliente num periodo encerrado. Recalcula tudo no
 * servidor (a tela pode estar velha); a unicidade de itens_fatura.locacao_id
 * garante que nenhuma locacao entra em duas faturas.
 */
export async function gerarFatura(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirPermissao('financeiro.registrar');

  const chave = z.string().min(1).safeParse(form.get('chave'));
  if (!chave.success) return { ok: false, erro: 'Fatura inválida.' };

  const grupo = (await faturasPendentes(hojeEmSaoPaulo())).find((g) => g.chave === chave.data);
  if (!grupo) return { ok: false, erro: 'Nada a faturar nesse período (já foi faturado?).' };
  if (!grupo.encerrado) return { ok: false, erro: 'O período ainda não terminou.' };

  const db = getDb();
  const cobrancaId = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(cobrancas).values({
        id: cobrancaId,
        clienteId: grupo.clienteId,
        origem: 'fatura',
        descricao: grupo.descricao,
        valorTotal: grupo.total,
        vencimentoEm: grupo.vencimentoEm,
      }),
      db
        .insert(itensFatura)
        .values(grupo.itens.map((i) => ({ cobrancaId, locacaoId: i.locacaoId, valor: i.valor }))),
    ]);
  } catch (erro) {
    if (violou(erro, 'itens_fatura_locacao_id_unique')) {
      return { ok: false, erro: 'Alguma locação desse período já foi faturada.' };
    }
    throw erro;
  }

  revalidatePath('/financeiro');
  return { ok: true };
}
