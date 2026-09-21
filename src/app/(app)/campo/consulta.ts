import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { getDb } from '@/db';
import {
  cacambas,
  cidades,
  clientes,
  locacoes,
  registrosCampo,
  tiposCacamba,
  usuarios,
} from '@/db/schema';
import { proximaEtapa } from '@/lib/dominio/locacao';
import type { UsuarioSessao } from '@/server/auth/sessao';

const retirada = alias(registrosCampo, 'retirada');

/**
 * OS com trabalho de rua pendente. O funcionario ve so as dele; o gestor ve
 * todas (e pode cobrir um motorista).
 */
export async function osDeCampo(usuario: UsuarioSessao, filtro?: { id: string }) {
  const condicoes: (SQL | undefined)[] = [
    or(
      inArray(locacoes.status, ['agendada', 'entregue', 'retirada_solicitada']),
      and(eq(locacoes.status, 'concluida'), isNull(locacoes.destinoEntulho)),
    ),
  ];
  if (usuario.papel !== 'gestor') condicoes.push(eq(locacoes.motoristaId, usuario.id));
  if (filtro) condicoes.push(eq(locacoes.id, filtro.id));

  const linhas = await getDb()
    .select({
      id: locacoes.id,
      numeroOs: locacoes.numeroOs,
      status: locacoes.status,
      destinoEntulho: locacoes.destinoEntulho,
      endereco: locacoes.enderecoEntrega,
      observacoes: locacoes.observacoes,
      vencimentoEm: locacoes.vencimentoEm,
      retiradaSolicitadaEm: locacoes.retiradaSolicitadaEm,
      cliente: clientes.nome,
      telefone: clientes.telefone,
      cidade: cidades.nome,
      uf: cidades.uf,
      numeracao: cacambas.numeracao,
      tipo: tiposCacamba.nome,
      motorista: usuarios.nome,
      retiradaId: retirada.id,
    })
    .from(locacoes)
    .innerJoin(clientes, eq(locacoes.clienteId, clientes.id))
    .innerJoin(cidades, eq(locacoes.cidadeId, cidades.id))
    .innerJoin(cacambas, eq(locacoes.cacambaId, cacambas.id))
    .innerJoin(tiposCacamba, eq(cacambas.tipoId, tiposCacamba.id))
    .leftJoin(usuarios, eq(locacoes.motoristaId, usuarios.id))
    .leftJoin(retirada, and(eq(retirada.locacaoId, locacoes.id), eq(retirada.etapa, 'retirada')))
    .where(and(...condicoes))
    .orderBy(locacoes.numeroOs);

  return linhas
    .map((l) => ({ ...l, etapa: proximaEtapa({ ...l, temRetiradaNoApp: l.retiradaId !== null }) }))
    .filter((l) => l.etapa !== null);
}

export type OsCampo = Awaited<ReturnType<typeof osDeCampo>>[number];

export function linkMapa(os: Pick<OsCampo, 'endereco' | 'cidade' | 'uf'>): string {
  const destino = `${os.endereco}, ${os.cidade} - ${os.uf}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
}
