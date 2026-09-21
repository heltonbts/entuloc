import { and, eq, inArray, isNull, notExists, or, type SQL } from 'drizzle-orm';
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
import { proximaEtapa, type EtapaCampo } from '@/lib/dominio/locacao';
import type { UsuarioSessao } from '@/server/auth/sessao';

const retirada = alias(registrosCampo, 'retirada');
const antiga = alias(locacoes, 'antiga');
const cacambaAntiga = alias(cacambas, 'cacamba_antiga');
const trocaPendente = alias(locacoes, 'troca_pendente');

/** O que o celular do motorista precisa para trabalhar, inclusive sem sinal. */
export type OsCampo = {
  id: string;
  numeroOs: number;
  etapa: EtapaCampo;
  cliente: string;
  telefone: string | null;
  endereco: string;
  cidade: string;
  uf: string;
  observacoes: string | null;
  numeracao: string;
  tipo: string;
  motorista: string | null;
  retiradaPedida: boolean;
  /** Na troca: numeracao da cacamba cheia que sai. */
  numeracaoRecolhida: string | null;
};

/**
 * OS com trabalho de rua pendente. O funcionario ve so as dele; o gestor ve
 * todas (e pode cobrir um motorista).
 */
export async function osDeCampo(usuario: UsuarioSessao): Promise<OsCampo[]> {
  const db = getDb();
  const condicoes: (SQL | undefined)[] = [
    or(
      inArray(locacoes.status, ['agendada', 'entregue', 'retirada_solicitada']),
      and(eq(locacoes.status, 'concluida'), isNull(locacoes.destinoEntulho)),
    ),
    // Quem tem troca agendada sai junto na OS da troca, nao numa retirada avulsa.
    notExists(
      db
        .select({ id: trocaPendente.id })
        .from(trocaPendente)
        .where(and(eq(trocaPendente.trocaDeId, locacoes.id), eq(trocaPendente.status, 'agendada'))),
    ),
  ];
  if (usuario.papel !== 'gestor') condicoes.push(eq(locacoes.motoristaId, usuario.id));

  const linhas = await db
    .select({
      id: locacoes.id,
      numeroOs: locacoes.numeroOs,
      status: locacoes.status,
      destinoEntulho: locacoes.destinoEntulho,
      trocaDeId: locacoes.trocaDeId,
      endereco: locacoes.enderecoEntrega,
      observacoes: locacoes.observacoes,
      cliente: clientes.nome,
      telefone: clientes.telefone,
      cidade: cidades.nome,
      uf: cidades.uf,
      numeracao: cacambas.numeracao,
      tipo: tiposCacamba.nome,
      motorista: usuarios.nome,
      retiradaId: retirada.id,
      numeracaoRecolhida: cacambaAntiga.numeracao,
    })
    .from(locacoes)
    .innerJoin(clientes, eq(locacoes.clienteId, clientes.id))
    .innerJoin(cidades, eq(locacoes.cidadeId, cidades.id))
    .innerJoin(cacambas, eq(locacoes.cacambaId, cacambas.id))
    .innerJoin(tiposCacamba, eq(cacambas.tipoId, tiposCacamba.id))
    .leftJoin(usuarios, eq(locacoes.motoristaId, usuarios.id))
    .leftJoin(retirada, and(eq(retirada.locacaoId, locacoes.id), eq(retirada.etapa, 'retirada')))
    .leftJoin(antiga, eq(locacoes.trocaDeId, antiga.id))
    .leftJoin(cacambaAntiga, eq(antiga.cacambaId, cacambaAntiga.id))
    .where(and(...condicoes))
    .orderBy(locacoes.numeroOs);

  return linhas.flatMap((l) => {
    const etapa = proximaEtapa({
      status: l.status,
      destinoEntulho: l.destinoEntulho,
      temRetiradaNoApp: l.retiradaId !== null,
      ehTroca: l.trocaDeId !== null,
    });
    if (!etapa) return [];
    return [
      {
        id: l.id,
        numeroOs: l.numeroOs,
        etapa,
        cliente: l.cliente,
        telefone: l.telefone,
        endereco: l.endereco,
        cidade: l.cidade,
        uf: l.uf,
        observacoes: l.observacoes,
        numeracao: l.numeracao,
        tipo: l.tipo,
        motorista: l.motorista,
        retiradaPedida: l.status === 'retirada_solicitada',
        numeracaoRecolhida: l.numeracaoRecolhida,
      },
    ];
  });
}
