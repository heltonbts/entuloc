import { count, eq } from 'drizzle-orm';
import Link from 'next/link';

import { Cartao } from '@/components/ui';
import { getDb } from '@/db';
import { cacambas, cidades, regrasMulta, tiposCacamba } from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';

// Le dados vivos do banco: nao pode ser prerenderizado no build, senao o HTML
// congela os numeros da hora do build e quebra o deploy sem DATABASE_URL.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Painel' };

export default async function PaginaPainel() {
  const db = getDb();
  const [frota, disponiveis, cidadesAtivas, regrasAtivas, tipos] = await Promise.all([
    db.select({ n: count() }).from(cacambas),
    db.select({ n: count() }).from(cacambas).where(eq(cacambas.status, 'disponivel')),
    db.select({ n: count() }).from(cidades).where(eq(cidades.ativa, true)),
    db.select({ n: count() }).from(regrasMulta).where(eq(regrasMulta.ativa, true)),
    db.select().from(tiposCacamba),
  ]);

  const pendencias = [
    tipos.some((t) => t.valorLocacao === 0) && {
      texto: 'Há tipo de caçamba sem valor definido.',
      href: '/cadastros/tipos',
    },
    frota[0].n === 0 && { texto: 'Nenhuma caçamba cadastrada na frota.', href: '/cadastros/frota' },
    cidadesAtivas[0].n === 0 && {
      texto: 'Nenhuma cidade atendida — não é possível cobrar frete.',
      href: '/cadastros/cidades',
    },
    regrasAtivas[0].n === 0 && {
      texto: 'Nenhuma regra de multa ativa — atrasos não geram cobrança.',
      href: '/cadastros/multas',
    },
  ].filter(Boolean) as { texto: string; href: string }[];

  const indicadores = [
    { rotulo: 'Caçambas na frota', valor: String(frota[0].n) },
    { rotulo: 'Disponíveis', valor: String(disponiveis[0].n) },
    { rotulo: 'Cidades atendidas', valor: String(cidadesAtivas[0].n) },
    { rotulo: 'Regras de multa ativas', valor: String(regrasAtivas[0].n) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">Painel</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((ind) => (
          <Cartao key={ind.rotulo}>
            <p className="text-navy-500 dark:text-navy-200 text-sm">{ind.rotulo}</p>
            <p className="font-display text-navy-700 mt-2 text-3xl font-extrabold dark:text-white">
              {ind.valor}
            </p>
          </Cartao>
        ))}
      </div>

      {pendencias.length > 0 && (
        <Cartao className="border-brand-300 bg-brand-50 dark:bg-navy-800">
          <h2 className="font-display text-navy-700 mb-3 font-bold dark:text-white">
            Falta configurar
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {pendencias.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="text-navy-700 hover:text-brand-600 dark:text-navy-100 underline underline-offset-2"
                >
                  {p.texto}
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <section>
        <h2 className="font-display text-navy-700 mb-3 text-lg font-bold dark:text-white">
          Tabela de preços
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {tipos.map((tipo) => (
            <Cartao key={tipo.id}>
              <p className="text-navy-700 font-semibold dark:text-white">{tipo.nome}</p>
              <p className="font-display text-brand-600 mt-1 text-2xl font-extrabold">
                {tipo.valorLocacao === 0 ? 'a definir' : formatarBRL(tipo.valorLocacao)}
              </p>
              <p className="text-navy-400 mt-1 text-xs">
                {tipo.diasInclusos} dias {tipo.contagemPrazo === 'uteis' ? 'úteis' : 'corridos'} ·
                frete à parte
              </p>
            </Cartao>
          ))}
        </div>
      </section>
    </div>
  );
}
