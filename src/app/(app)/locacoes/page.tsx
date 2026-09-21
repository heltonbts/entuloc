import { and, asc, desc, eq, notExists } from 'drizzle-orm';
import Link from 'next/link';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import {
  cacambas,
  cidades,
  clientes,
  locacoes,
  regrasMulta,
  tiposCacamba,
  usuarios,
} from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import { podeAcessar } from '@/lib/dominio/tipos';
import { exigirSessao } from '@/server/auth/guarda';

import { AcoesLocacao, FormularioLocacao, TrocarMotorista } from './formulario';

export const metadata = { title: 'Locações' };
export const dynamic = 'force-dynamic';

const rotuloStatus: Record<
  string,
  { texto: string; tom: 'neutro' | 'marca' | 'alerta' | 'sucesso' }
> = {
  orcamento: { texto: 'Orçamento', tom: 'neutro' },
  agendada: { texto: 'Agendada', tom: 'neutro' },
  entregue: { texto: 'Entregue', tom: 'marca' },
  retirada_solicitada: { texto: 'Retirada pedida', tom: 'alerta' },
  concluida: { texto: 'Concluída', tom: 'sucesso' },
  cancelada: { texto: 'Cancelada', tom: 'neutro' },
};

function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default async function PaginaLocacoes() {
  const usuario = await exigirSessao();
  const db = getDb();

  const [lista, opcoesCliente, opcoesCacamba, opcoesCidade, opcoesRegra, motoristas] =
    await Promise.all([
      db
        .select({
          id: locacoes.id,
          numeroOs: locacoes.numeroOs,
          status: locacoes.status,
          motoristaId: locacoes.motoristaId,
          motivoCancelamento: locacoes.motivoCancelamento,
          endereco: locacoes.enderecoEntrega,
          valorLocacao: locacoes.valorLocacao,
          valorFrete: locacoes.valorFrete,
          multaApurada: locacoes.multaApurada,
          entregaEm: locacoes.entregaEm,
          vencimentoEm: locacoes.vencimentoEm,
          cliente: clientes.nome,
          numeracao: cacambas.numeracao,
          cidade: cidades.nome,
        })
        .from(locacoes)
        .innerJoin(clientes, eq(locacoes.clienteId, clientes.id))
        .innerJoin(cacambas, eq(locacoes.cacambaId, cacambas.id))
        .innerJoin(cidades, eq(locacoes.cidadeId, cidades.id))
        .orderBy(desc(locacoes.criadoEm)),
      db
        .select({
          id: clientes.id,
          rotulo: clientes.nome,
          construtora: clientes.construtora,
          endereco: clientes.endereco,
          cidade: clientes.cidade,
          uf: clientes.uf,
        })
        .from(clientes)
        .orderBy(asc(clientes.nome)),
      db
        .select({ id: cacambas.id, rotulo: cacambas.numeracao, tipo: tiposCacamba.nome })
        .from(cacambas)
        .innerJoin(tiposCacamba, eq(cacambas.tipoId, tiposCacamba.id))
        .where(
          and(
            eq(cacambas.status, 'disponivel'),
            // Fora as ja prometidas numa locacao agendada.
            notExists(
              db
                .select({ id: locacoes.id })
                .from(locacoes)
                .where(and(eq(locacoes.cacambaId, cacambas.id), eq(locacoes.status, 'agendada'))),
            ),
          ),
        )
        .orderBy(asc(cacambas.numeracao)),
      db
        .select({ id: cidades.id, rotulo: cidades.nome, uf: cidades.uf, frete: cidades.valorFrete })
        .from(cidades)
        .where(eq(cidades.ativa, true))
        .orderBy(asc(cidades.nome)),
      db
        .select({ id: regrasMulta.id, rotulo: regrasMulta.nome })
        .from(regrasMulta)
        .where(eq(regrasMulta.ativa, true)),
      db
        .select({ id: usuarios.id, rotulo: usuarios.nome })
        .from(usuarios)
        .where(eq(usuarios.ativo, true))
        .orderBy(asc(usuarios.nome)),
    ]);

  const podeFechar = podeAcessar(usuario.papel, 'locacoes.fechar');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Locações
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Ao concluir, o sistema apura a multa e gera a conta a receber automaticamente.
        </p>
      </div>

      <Cartao>
        <TituloSecao>Nova locação</TituloSecao>
        <FormularioLocacao
          clientes={opcoesCliente.map((c) => ({
            ...c,
            rotulo: c.construtora ? `${c.rotulo} (construtora)` : c.rotulo,
          }))}
          cacambas={opcoesCacamba.map((c) => ({ id: c.id, rotulo: `${c.rotulo} — ${c.tipo}` }))}
          cidades={opcoesCidade.map((c) => ({
            id: c.id,
            nome: c.rotulo,
            uf: c.uf,
            frete: c.frete,
            rotulo: `${c.rotulo}/${c.uf} — frete ${formatarBRL(c.frete)}`,
          }))}
          regras={opcoesRegra}
          motoristas={motoristas}
        />
      </Cartao>

      <section>
        <TituloSecao>{lista.length} locação(ões)</TituloSecao>
        {lista.length === 0 ? (
          <Cartao>
            <Vazio>Nenhuma locação registrada ainda.</Vazio>
          </Cartao>
        ) : (
          <Tabela
            cabecalho={[
              'OS',
              'Cliente',
              'Caçamba',
              'Entrega',
              'Vencimento',
              'Total',
              'Situação',
              'Ação',
            ]}
          >
            {lista.map((l) => {
              const status = rotuloStatus[l.status] ?? { texto: l.status, tom: 'neutro' as const };
              const total = l.valorLocacao + l.valorFrete + (l.multaApurada ?? 0);
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/os/${l.id}`}
                      className="text-brand-600 hover:text-brand-700 font-semibold underline underline-offset-2"
                    >
                      Nº {l.numeroOs}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-navy-700 block font-medium dark:text-white">
                      {l.cliente}
                    </span>
                    <span className="text-navy-400 text-xs">
                      {l.cidade} · {l.endereco}
                    </span>
                  </td>
                  <td className="font-display text-navy-700 px-4 py-3 font-bold dark:text-white">
                    {l.numeracao}
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                    {formatarData(l.entregaEm)}
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                    {formatarData(l.vencimentoEm)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-navy-700 block font-semibold dark:text-white">
                      {formatarBRL(total)}
                    </span>
                    {(l.multaApurada ?? 0) > 0 && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        multa {formatarBRL(l.multaApurada ?? 0)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Etiqueta tom={status.tom}>{status.texto}</Etiqueta>
                    {l.motivoCancelamento && (
                      <span className="text-navy-400 mt-1 block text-xs">
                        {l.motivoCancelamento}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {['agendada', 'entregue', 'retirada_solicitada'].includes(l.status) ? (
                      <TrocarMotorista id={l.id} atual={l.motoristaId} motoristas={motoristas} />
                    ) : (
                      <span className="text-navy-400 text-xs">
                        {motoristas.find((m) => m.id === l.motoristaId)?.rotulo ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AcoesLocacao id={l.id} status={l.status} podeFechar={podeFechar} />
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </section>
    </div>
  );
}
