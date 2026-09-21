import { asc, count, inArray } from 'drizzle-orm';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { clientes, locacoes } from '@/db/schema';
import { formatarDocumento } from '@/lib/documento';
import { STATUS_ATIVOS } from '@/lib/dominio/locacao';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { alternarConstrutora } from './actions';
import { FormularioCliente } from './formulario';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default async function PaginaClientes() {
  await exigirPermissaoPagina('clientes.editar');
  const db = getDb();
  const [lista, ativas] = await Promise.all([
    db.select().from(clientes).orderBy(asc(clientes.nome)),
    db
      .select({ clienteId: locacoes.clienteId, n: count() })
      .from(locacoes)
      .where(inArray(locacoes.status, [...STATUS_ATIVOS]))
      .groupBy(locacoes.clienteId),
  ]);
  const ativasPorCliente = new Map(ativas.map((a) => [a.clienteId, a.n]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Clientes
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Construtoras, condomínios e pessoa física. O CPF/CNPJ é conferido pelo dígito verificador.
        </p>
      </div>

      <Cartao>
        <TituloSecao>Novo cliente</TituloSecao>
        <FormularioCliente />
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
              'Ação',
            ]}
          >
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="text-navy-700 px-4 py-3 font-medium dark:text-white">{c.nome}</td>
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
                <td className="px-4 py-3">
                  <form action={alternarConstrutora}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="construtora" value={c.construtora ? 'nao' : 'sim'} />
                    <button
                      type="submit"
                      className="text-navy-500 hover:text-brand-600 dark:text-navy-200 focus-visible:outline-brand-600 rounded text-xs font-medium whitespace-nowrap underline underline-offset-2"
                    >
                      {c.construtora ? 'Desmarcar construtora' : 'Marcar como construtora'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>
    </div>
  );
}
