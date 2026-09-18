import { asc } from 'drizzle-orm';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { exigirPermissaoPagina } from '@/server/auth/guarda';
import { cidades } from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';

import { FormularioCidade } from './formulario';

// Le dados vivos do banco: nao pode ser prerenderizado no build, senao o HTML
// congela os numeros da hora do build e quebra o deploy sem DATABASE_URL.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Cidades e frete' };

export default async function PaginaCidades() {
  await exigirPermissaoPagina('cidades.editar');

  const lista = await getDb().select().from(cidades).orderBy(asc(cidades.uf), asc(cidades.nome));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Cidades e frete
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          O frete é cobrado por cidade. Cidade que não estiver aqui é tratada como fora da área de
          atendimento.
        </p>
      </div>

      <Cartao>
        <TituloSecao>Nova cidade</TituloSecao>
        <FormularioCidade />
      </Cartao>

      <section>
        <TituloSecao>{lista.length} cidade(s) cadastrada(s)</TituloSecao>
        {lista.length === 0 ? (
          <Cartao>
            <Vazio>Nenhuma cidade ainda. Cadastre a primeira acima.</Vazio>
          </Cartao>
        ) : (
          <Tabela cabecalho={['Cidade', 'UF', 'Frete', 'Situação']}>
            {lista.map((cidade) => (
              <tr key={cidade.id}>
                <td className="text-navy-700 px-4 py-3 font-medium dark:text-white">
                  {cidade.nome}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">{cidade.uf}</td>
                <td className="text-navy-700 px-4 py-3 font-semibold dark:text-white">
                  {formatarBRL(cidade.valorFrete)}
                </td>
                <td className="px-4 py-3">
                  {cidade.ativa ? (
                    <Etiqueta tom="sucesso">Atendida</Etiqueta>
                  ) : (
                    <Etiqueta>Inativa</Etiqueta>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>
    </div>
  );
}
