import { asc } from 'drizzle-orm';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { clientes } from '@/db/schema';
import { formatarDocumento } from '@/lib/documento';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { FormularioCliente } from './formulario';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default async function PaginaClientes() {
  await exigirPermissaoPagina('clientes.editar');
  const lista = await getDb().select().from(clientes).orderBy(asc(clientes.nome));

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
          <Tabela cabecalho={['Nome', 'Tipo', 'CPF / CNPJ', 'Contato']}>
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="text-navy-700 px-4 py-3 font-medium dark:text-white">{c.nome}</td>
                <td className="px-4 py-3">
                  <Etiqueta tom={c.tipoPessoa === 'juridica' ? 'marca' : 'neutro'}>
                    {c.tipoPessoa === 'juridica' ? 'PJ' : 'PF'}
                  </Etiqueta>
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                  {c.documento ? formatarDocumento(c.documento) : '—'}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                  {c.telefone ?? c.email ?? '—'}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>
    </div>
  );
}
