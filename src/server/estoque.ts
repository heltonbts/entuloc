import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { col } from '@/db/sql';
import {
  cacambas,
  locacoes,
  materiais,
  movimentosEstoque,
  tiposCacamba,
  vendasMaterial,
} from '@/db/schema';
import { deNumeric, paraNumeric, saldoMaterial, type Milesimos } from '@/lib/dominio/estoque';
import type { DataISO } from '@/lib/dominio/tipos';

type Locacao = typeof locacoes.$inferSelect;

export type SaldoMaterial = {
  id: string;
  nome: string;
  unidade: 'tonelada' | 'metro_cubico';
  precoUnitario: number;
  ativo: boolean;
  saldo: Milesimos;
};

/** Estoque atual: entulho bruto (m³) e cada material reciclado. */
export async function saldosDoDeposito(): Promise<{
  entulho: Milesimos;
  materiais: SaldoMaterial[];
}> {
  const db = getDb();
  const [[entulho], linhas] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${movimentosEstoque.quantidade}), 0)` })
      .from(movimentosEstoque)
      .where(isNull(movimentosEstoque.materialId)),
    db
      .select({
        id: materiais.id,
        nome: materiais.nome,
        unidade: materiais.unidade,
        precoUnitario: materiais.precoUnitario,
        ativo: materiais.ativo,
        movimentos: sql<string>`(select coalesce(sum(${movimentosEstoque.quantidade}), 0)
          from ${movimentosEstoque} where ${col(movimentosEstoque.materialId)} = ${col(materiais.id)})`,
        // Venda de entulho direto da cacamba (locacao_id) nunca passou pelo deposito.
        vendido: sql<string>`(select coalesce(sum(${vendasMaterial.quantidade}), 0)
          from ${vendasMaterial} where ${col(vendasMaterial.materialId)} = ${col(materiais.id)}
          and ${vendasMaterial.locacaoId} is null)`,
      })
      .from(materiais)
      .orderBy(asc(materiais.nome)),
  ]);

  return {
    entulho: deNumeric(entulho?.total),
    materiais: linhas.map((m) => ({
      id: m.id,
      nome: m.nome,
      unidade: m.unidade,
      precoUnitario: m.precoUnitario,
      ativo: m.ativo,
      saldo: saldoMaterial(deNumeric(m.movimentos), deNumeric(m.vendido)),
    })),
  };
}

export async function saldoDoMaterial(materialId: string): Promise<Milesimos> {
  const { materiais: lista } = await saldosDoDeposito();
  return lista.find((m) => m.id === materialId)?.saldo ?? 0;
}

/**
 * Baixa "deixei no deposito": o entulho da cacamba entra no estoque, estimado
 * pelo volume do tipo (quem descarrega nao pesa). Ajustes corrigem depois.
 */
export async function comandoEntradaNaBaixa(locacao: Locacao, dia: DataISO, usuarioId: string) {
  const [cacamba] = await getDb()
    .select({ numeracao: cacambas.numeracao, volume: tiposCacamba.volumeM3 })
    .from(cacambas)
    .innerJoin(tiposCacamba, eq(cacambas.tipoId, tiposCacamba.id))
    .where(eq(cacambas.id, locacao.cacambaId))
    .limit(1);
  const volume = deNumeric(cacamba?.volume);
  if (volume <= 0) return [];

  return [
    getDb()
      .insert(movimentosEstoque)
      .values({
        tipo: 'entrada_entulho',
        quantidade: paraNumeric(volume),
        locacaoId: locacao.id,
        observacao: `Caçamba ${cacamba.numeracao} — OS ${locacao.numeroOs} (volume estimado)`,
        ocorridoEm: dia,
        registradoPorId: usuarioId,
      }),
  ];
}

export async function ultimosMovimentos(limite = 50) {
  return getDb()
    .select({
      id: movimentosEstoque.id,
      tipo: movimentosEstoque.tipo,
      quantidade: movimentosEstoque.quantidade,
      observacao: movimentosEstoque.observacao,
      ocorridoEm: movimentosEstoque.ocorridoEm,
      material: materiais.nome,
      unidade: materiais.unidade,
    })
    .from(movimentosEstoque)
    .leftJoin(materiais, eq(movimentosEstoque.materialId, materiais.id))
    .orderBy(sql`${movimentosEstoque.ocorridoEm} desc, ${movimentosEstoque.criadoEm} desc`)
    .limit(limite);
}

/** Entulho que entrou no mes (m³), para o painel do deposito. */
export async function entradasNoPeriodo(inicio: DataISO, fim: DataISO): Promise<Milesimos> {
  const [linha] = await getDb()
    .select({ total: sql<string>`coalesce(sum(${movimentosEstoque.quantidade}), 0)` })
    .from(movimentosEstoque)
    .where(
      and(
        eq(movimentosEstoque.tipo, 'entrada_entulho'),
        sql`${movimentosEstoque.ocorridoEm} between ${inicio} and ${fim}`,
      ),
    );
  return deNumeric(linha?.total);
}
