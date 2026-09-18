import { desc } from 'drizzle-orm';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { regrasMulta } from '@/db/schema';
import { formatarBRL, formatarPercentual } from '@/lib/dinheiro';

import { BotaoAlternar, FormularioRegraMulta } from './formulario';

// Le dados vivos do banco: nao pode ser prerenderizado no build, senao o HTML
// congela os numeros da hora do build e quebra o deploy sem DATABASE_URL.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Regras de multa' };

export default async function PaginaMultas() {
  const regras = await getDb().select().from(regrasMulta).orderBy(desc(regrasMulta.criadoEm));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Regras de multa
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Aplicadas quando a caçamba passa do prazo sem pedido de retirada. O percentual incide só
          sobre a locação — o frete não entra na conta.
        </p>
      </div>

      <Cartao>
        <TituloSecao>Nova regra</TituloSecao>
        <FormularioRegraMulta />
      </Cartao>

      <section>
        <TituloSecao>{regras.length} regra(s) cadastrada(s)</TituloSecao>
        {regras.length === 0 ? (
          <Cartao>
            <Vazio>Nenhuma regra ainda. Sem regra cadastrada, o atraso não gera cobrança.</Vazio>
          </Cartao>
        ) : (
          <Tabela cabecalho={['Regra', 'Cobrança', 'Carência', 'Teto', 'Situação', '']}>
            {regras.map((regra) => (
              <tr key={regra.id}>
                <td className="px-4 py-3">
                  <span className="text-navy-700 block font-medium dark:text-white">
                    {regra.nome}
                  </span>
                  <span className="text-navy-400 text-xs">
                    {regra.base === 'percentual'
                      ? `${formatarPercentual(regra.percentualBps ?? 0)}% da locação`
                      : formatarBRL(regra.valorFixo ?? 0)}
                  </span>
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                  {regra.cobranca === 'por_dia' ? 'Por dia' : 'Uma vez'}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                  {regra.diasCarencia === 0 ? '—' : `${regra.diasCarencia} dia(s)`}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                  {regra.tetoMaximo ? formatarBRL(regra.tetoMaximo) : '—'}
                </td>
                <td className="px-4 py-3">
                  {regra.ativa ? (
                    <Etiqueta tom="marca">Ativa</Etiqueta>
                  ) : (
                    <Etiqueta>Inativa</Etiqueta>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <BotaoAlternar id={regra.id} ativa={regra.ativa} />
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>
    </div>
  );
}
