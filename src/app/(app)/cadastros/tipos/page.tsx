import { asc } from 'drizzle-orm';

import { Cartao } from '@/components/ui';
import { getDb } from '@/db';
import { exigirPermissaoPagina } from '@/server/auth/guarda';
import { tiposCacamba } from '@/db/schema';

import { FormularioTipo } from './formulario';

// Le dados vivos do banco: nao pode ser prerenderizado no build, senao o HTML
// congela os numeros da hora do build e quebra o deploy sem DATABASE_URL.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Tipos de caçamba' };

export default async function PaginaTipos() {
  await exigirPermissaoPagina('precos.editar');

  const tipos = await getDb().select().from(tiposCacamba).orderBy(asc(tiposCacamba.volumeM3));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Tipos de caçamba
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Valor e prazo padrão de cada tipo. Alterar aqui não muda locações já fechadas — elas
          guardam o valor combinado na época.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {tipos.map((tipo) => (
          <Cartao key={tipo.id}>
            <FormularioTipo
              id={tipo.id}
              nome={tipo.nome}
              volumeM3={tipo.volumeM3}
              valorLocacao={tipo.valorLocacao}
              diasInclusos={tipo.diasInclusos}
              contagemPrazo={tipo.contagemPrazo}
            />
          </Cartao>
        ))}
      </div>
    </div>
  );
}
