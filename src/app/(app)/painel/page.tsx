import { asc, count, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';

import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { getDb } from '@/db';
import { cacambas, cidades, clientes, locacoes, regrasMulta, tiposCacamba } from '@/db/schema';
import { formatarBRL } from '@/lib/dinheiro';
import {
  hojeEmSaoPaulo,
  situacaoAluguel,
  STATUS_ATIVOS,
  type SituacaoAluguel,
} from '@/lib/dominio/locacao';

function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

const plural = (n: number, palavra: string) => `${n} ${palavra}${n === 1 ? '' : 's'}`;

function descreverSituacao(s: SituacaoAluguel): {
  texto: string;
  tom: 'neutro' | 'marca' | 'alerta' | 'sucesso' | 'perigo';
} {
  switch (s.tipo) {
    case 'a_entregar':
      return { texto: 'A entregar', tom: 'neutro' };
    case 'em_dia':
      return { texto: `Em dia · ${plural(s.diasRestantes, 'dia')}`, tom: 'sucesso' };
    case 'vence_hoje':
      return { texto: 'Vence hoje', tom: 'alerta' };
    case 'atrasada':
      return { texto: `Atrasada ${plural(s.diasAtraso, 'dia')}`, tom: 'perigo' };
    case 'retirada_pedida':
      return {
        texto:
          s.diasAtraso > 0
            ? `Retirada pedida · ${plural(s.diasAtraso, 'dia')} de atraso`
            : 'Retirada pedida',
        tom: 'marca',
      };
  }
}

/** Atrasadas primeiro: e o que exige acao hoje. */
const prioridade: Record<SituacaoAluguel['tipo'], number> = {
  atrasada: 0,
  vence_hoje: 1,
  retirada_pedida: 2,
  a_entregar: 3,
  em_dia: 4,
};

// Le dados vivos do banco: nao pode ser prerenderizado no build, senao o HTML
// congela os numeros da hora do build e quebra o deploy sem DATABASE_URL.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Painel' };

export default async function PaginaPainel({ searchParams }: PageProps<'/painel'>) {
  const { acesso } = await searchParams;
  const db = getDb();
  const [frota, disponiveis, cidadesAtivas, regrasAtivas, tipos, ativas] = await Promise.all([
    db.select({ n: count() }).from(cacambas),
    db.select({ n: count() }).from(cacambas).where(eq(cacambas.status, 'disponivel')),
    db.select({ n: count() }).from(cidades).where(eq(cidades.ativa, true)),
    db.select({ n: count() }).from(regrasMulta).where(eq(regrasMulta.ativa, true)),
    db.select().from(tiposCacamba),
    db
      .select({
        id: locacoes.id,
        status: locacoes.status,
        vencimentoEm: locacoes.vencimentoEm,
        retiradaSolicitadaEm: locacoes.retiradaSolicitadaEm,
        contagemPrazo: locacoes.contagemPrazo,
        entregaEm: locacoes.entregaEm,
        endereco: locacoes.enderecoEntrega,
        cliente: clientes.nome,
        telefone: clientes.telefone,
        numeracao: cacambas.numeracao,
        tipo: tiposCacamba.nome,
        cidade: cidades.nome,
      })
      .from(locacoes)
      .innerJoin(clientes, eq(locacoes.clienteId, clientes.id))
      .innerJoin(cacambas, eq(locacoes.cacambaId, cacambas.id))
      .innerJoin(tiposCacamba, eq(cacambas.tipoId, tiposCacamba.id))
      .innerJoin(cidades, eq(locacoes.cidadeId, cidades.id))
      .where(inArray(locacoes.status, [...STATUS_ATIVOS]))
      .orderBy(asc(locacoes.vencimentoEm)),
  ]);

  const hoje = hojeEmSaoPaulo();
  const alugadas = ativas
    .map((l) => ({ ...l, situacao: situacaoAluguel(l, hoje) }))
    .sort((a, b) => prioridade[a.situacao.tipo] - prioridade[b.situacao.tipo]);
  const atrasadas = alugadas.filter((l) => l.situacao.tipo === 'atrasada').length;

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
    { rotulo: 'Alugadas', valor: String(alugadas.length) },
    { rotulo: 'Atrasadas', valor: String(atrasadas), perigo: atrasadas > 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">Painel</h1>

      {acesso === 'negado' && (
        <p
          role="alert"
          className="rounded-md border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          Você não tem acesso a essa área. Fale com o gestor.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((ind) => (
          <Cartao key={ind.rotulo}>
            <p className="text-navy-500 dark:text-navy-200 text-sm">{ind.rotulo}</p>
            <p
              className={
                ind.perigo
                  ? 'font-display mt-2 text-3xl font-extrabold text-red-600 dark:text-red-400'
                  : 'font-display text-navy-700 mt-2 text-3xl font-extrabold dark:text-white'
              }
            >
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
        <TituloSecao
          acao={
            <Link
              href="/locacoes"
              className="text-brand-600 hover:text-brand-700 text-sm font-medium underline underline-offset-2"
            >
              Ver locações
            </Link>
          }
        >
          Caçambas alugadas agora
        </TituloSecao>
        {alugadas.length === 0 ? (
          <Cartao>
            <Vazio>Nenhuma caçamba alugada no momento.</Vazio>
          </Cartao>
        ) : (
          <Tabela
            cabecalho={['Caçamba', 'Cliente', 'Endereço', 'Entrega', 'Vencimento', 'Situação']}
          >
            {alugadas.map((l) => {
              const situacao = descreverSituacao(l.situacao);
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <span className="font-display text-navy-700 block font-bold dark:text-white">
                      {l.numeracao}
                    </span>
                    <span className="text-navy-400 text-xs">{l.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-navy-700 block font-medium dark:text-white">
                      {l.cliente}
                    </span>
                    {l.telefone && <span className="text-navy-400 text-xs">{l.telefone}</span>}
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3">
                    {l.endereco}
                    <span className="text-navy-400 block text-xs">{l.cidade}</span>
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                    {formatarData(l.entregaEm)}
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                    {formatarData(l.vencimentoEm)}
                  </td>
                  <td className="px-4 py-3">
                    <Etiqueta tom={situacao.tom}>{situacao.texto}</Etiqueta>
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </section>

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
