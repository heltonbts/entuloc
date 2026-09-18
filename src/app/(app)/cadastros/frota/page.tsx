import { asc, eq } from 'drizzle-orm';

import { Cartao, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { exigirPermissaoPagina } from '@/server/auth/guarda';
import { cacambas, tiposCacamba } from '@/db/schema';

import { FormularioCacamba, SeletorStatus } from './formulario';

// Le dados vivos do banco: nao pode ser prerenderizado no build, senao o HTML
// congela os numeros da hora do build e quebra o deploy sem DATABASE_URL.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Frota' };

export default async function PaginaFrota() {
  await exigirPermissaoPagina('frota.editar');

  const db = getDb();
  const [tipos, frota] = await Promise.all([
    db
      .select({ id: tiposCacamba.id, nome: tiposCacamba.nome })
      .from(tiposCacamba)
      .where(eq(tiposCacamba.ativo, true))
      .orderBy(asc(tiposCacamba.volumeM3)),
    db
      .select({
        id: cacambas.id,
        numeracao: cacambas.numeracao,
        status: cacambas.status,
        observacoes: cacambas.observacoes,
        tipoNome: tiposCacamba.nome,
      })
      .from(cacambas)
      .innerJoin(tiposCacamba, eq(cacambas.tipoId, tiposCacamba.id))
      .orderBy(asc(cacambas.numeracao)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Frota
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Cada caçamba física com sua numeração. A numeração é única — o sistema recusa duplicata.
        </p>
      </div>

      <Cartao>
        <TituloSecao>Nova caçamba</TituloSecao>
        <FormularioCacamba tipos={tipos} />
      </Cartao>

      <section>
        <TituloSecao>{frota.length} caçamba(s) na frota</TituloSecao>
        {frota.length === 0 ? (
          <Cartao>
            <Vazio>Nenhuma caçamba cadastrada ainda.</Vazio>
          </Cartao>
        ) : (
          <Tabela cabecalho={['Numeração', 'Tipo', 'Situação', 'Observações']}>
            {frota.map((cacamba) => (
              <tr key={cacamba.id}>
                <td className="font-display text-navy-700 px-4 py-3 font-bold dark:text-white">
                  {cacamba.numeracao}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">{cacamba.tipoNome}</td>
                <td className="px-4 py-3">
                  <SeletorStatus id={cacamba.id} status={cacamba.status} />
                </td>
                <td className="text-navy-400 px-4 py-3">{cacamba.observacoes ?? '—'}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>
    </div>
  );
}
