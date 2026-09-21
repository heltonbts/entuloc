import { asc, count, inArray, sql } from 'drizzle-orm';
import Link from 'next/link';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { col } from '@/db/sql';
import { clientes, cobrancas, locacoes, recebimentos } from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import { formatarDocumento } from '@/lib/documento';
import { rotuloFormaCobranca } from '@/lib/dominio/faturamento';
import { STATUS_ATIVOS } from '@/lib/dominio/locacao';
import { podeAcessar } from '@/lib/dominio/tipos';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { FormularioCliente } from './formulario';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default async function PaginaClientes() {
  const usuario = await exigirPermissaoPagina('clientes.editar');
  const veDinheiro = podeAcessar(usuario.papel, 'financeiro.ver');
  const db = getDb();

  const [lista, ativas, saldos] = await Promise.all([
    db.select().from(clientes).orderBy(asc(clientes.nome)),
    db
      .select({ clienteId: locacoes.clienteId, n: count() })
      .from(locacoes)
      .where(inArray(locacoes.status, [...STATUS_ATIVOS]))
      .groupBy(locacoes.clienteId),
    // Saldo = total das cobrancas nao canceladas menos o recebido, por cliente.
    veDinheiro
      ? db
          .select({
            clienteId: cobrancas.clienteId,
            saldo: sql<number>`coalesce(sum(greatest(0, ${cobrancas.valorTotal} - (
              select coalesce(sum(${recebimentos.valor}), 0) from ${recebimentos}
              where ${col(recebimentos.cobrancaId)} = ${col(cobrancas.id)}))), 0)`.mapWith(Number),
          })
          .from(cobrancas)
          .where(sql`not ${cobrancas.cancelada}`)
          .groupBy(cobrancas.clienteId)
      : Promise.resolve([]),
  ]);
  const ativasPorCliente = new Map(ativas.map((a) => [a.clienteId, a.n]));
  const saldoPorCliente = new Map(saldos.map((s) => [s.clienteId, s.saldo]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Clientes
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Construtoras, condomínios e pessoa física. Toque no nome para editar e ver o histórico.
        </p>
      </div>

      <Cartao>
        <TituloSecao>Novo cliente</TituloSecao>
        <FormularioCliente podeCobranca={podeAcessar(usuario.papel, 'financeiro.registrar')} />
      </Cartao>

      <section>
        <TituloSecao>{lista.length} cliente(s)</TituloSecao>
        {lista.length === 0 ? (
          <Cartao>
            <Vazio>Nenhum cliente cadastrado ainda.</Vazio>
          </Cartao>
        ) : (
          <Tabela
            cabecalho={[
              'Nome',
              'Endereço',
              'Tipo',
              'CPF / CNPJ',
              'Contato',
              'Caçambas alugadas',
              ...(veDinheiro ? ['Cobrança', 'Em aberto'] : []),
            ]}
          >
            {lista.map((c) => {
              const saldo = saldoPorCliente.get(c.id) ?? 0;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="text-navy-700 hover:text-brand-600 font-medium underline-offset-2 hover:underline dark:text-white"
                    >
                      {c.nome}
                    </Link>
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                    {c.endereco}
                    <span className="text-navy-400 block text-xs">
                      {c.cidade}/{c.uf}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      <Etiqueta tom={c.tipoPessoa === 'juridica' ? 'marca' : 'neutro'}>
                        {c.tipoPessoa === 'juridica' ? 'PJ' : 'PF'}
                      </Etiqueta>
                      {c.construtora && <Etiqueta tom="marca">Construtora</Etiqueta>}
                    </span>
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                    {c.documento ? formatarDocumento(c.documento) : '—'}
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                    {c.telefone ?? c.email ?? '—'}
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                    {ativasPorCliente.get(c.id) ?? 0}
                  </td>
                  {veDinheiro && (
                    <>
                      <td className="text-navy-500 dark:text-navy-200 px-4 py-3 text-xs whitespace-nowrap capitalize">
                        {rotuloFormaCobranca(c.formaCobranca, c.periodoFatura)}
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap ${saldo > 0 ? 'text-navy-700 font-semibold dark:text-white' : 'text-navy-400'}`}
                      >
                        {formatarBRL(saldo)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </Tabela>
        )}
      </section>
    </div>
  );
}
