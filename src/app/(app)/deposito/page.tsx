import { Cartao, Etiqueta, Tabela, TituloSecao, Vazio } from '@/components/ui';
import { formatarBRL } from '@/lib/dinheiro';
import { deNumeric, formatarQuantidade } from '@/lib/dominio/estoque';
import { periodoDaFatura } from '@/lib/dominio/faturamento';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import { podeAcessar } from '@/lib/dominio/tipos';
import { exigirPermissaoPagina } from '@/server/auth/guarda';
import { entradasNoPeriodo, saldosDoDeposito, ultimosMovimentos } from '@/server/estoque';

import { FormularioAjuste, FormularioEntrada, FormularioProducao } from './formulario';

export const metadata = { title: 'Depósito' };
export const dynamic = 'force-dynamic';

const rotuloTipo = {
  entrada_entulho: { texto: 'Entrada', tom: 'marca' },
  producao: { texto: 'Produção', tom: 'sucesso' },
  consumo_entulho: { texto: 'Consumo', tom: 'neutro' },
  ajuste: { texto: 'Ajuste', tom: 'alerta' },
} as const;

export default async function PaginaDeposito() {
  const usuario = await exigirPermissaoPagina('deposito.registrar');
  const gestor = podeAcessar(usuario.papel, 'materiais.editar');
  const hoje = hojeEmSaoPaulo();
  const mes = periodoDaFatura(hoje, 'mensal');

  const [{ entulho, materiais }, movimentos, entradasMes] = await Promise.all([
    saldosDoDeposito(),
    ultimosMovimentos(),
    entradasNoPeriodo(mes.inicio, mes.fim),
  ]);

  const ativos = materiais.filter((m) => m.ativo);
  const opcoes = ativos.map((m) => ({
    id: m.id,
    rotulo: `${m.nome} (${m.unidade === 'tonelada' ? 't' : 'm³'})`,
  }));
  const valorEmEstoque = ativos.reduce(
    (soma, m) => soma + Math.max(0, Math.round((m.saldo * m.precoUnitario) / 1000)),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Depósito
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          O entulho das caçambas entra sozinho quando o motorista dá baixa no depósito (volume
          estimado pela caçamba). A venda de material no Financeiro baixa o estoque.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Cartao>
          <p className="text-navy-500 dark:text-navy-200 text-sm">Entulho bruto no pátio</p>
          <p
            className={`font-display mt-2 text-2xl font-extrabold ${entulho < 0 ? 'text-red-600 dark:text-red-400' : 'text-navy-700 dark:text-white'}`}
          >
            {formatarQuantidade(entulho, 'metro_cubico')}
          </p>
          {entulho < 0 && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Consumo maior que a entrada estimada: faça um ajuste pela contagem.
            </p>
          )}
        </Cartao>
        <Cartao>
          <p className="text-navy-500 dark:text-navy-200 text-sm">Entrou este mês</p>
          <p className="font-display text-navy-700 mt-2 text-2xl font-extrabold dark:text-white">
            {formatarQuantidade(entradasMes, 'metro_cubico')}
          </p>
        </Cartao>
        <Cartao>
          <p className="text-navy-500 dark:text-navy-200 text-sm">
            Material para vender (a preço de tabela)
          </p>
          <p className="font-display text-brand-600 mt-2 text-2xl font-extrabold">
            {formatarBRL(valorEmEstoque)}
          </p>
        </Cartao>
      </div>

      <section>
        <TituloSecao>Estoque de material reciclado</TituloSecao>
        {ativos.length === 0 ? (
          <Cartao>
            <Vazio>Nenhum material cadastrado. Cadastre em Financeiro → Materiais.</Vazio>
          </Cartao>
        ) : (
          <Tabela cabecalho={['Material', 'Em estoque', 'Preço', 'Valor em estoque']}>
            {ativos.map((m) => (
              <tr key={m.id}>
                <td className="text-navy-700 px-4 py-3 font-medium dark:text-white">{m.nome}</td>
                <td
                  className={`px-4 py-3 font-semibold whitespace-nowrap ${m.saldo <= 0 ? 'text-red-600 dark:text-red-400' : 'text-navy-700 dark:text-white'}`}
                >
                  {formatarQuantidade(m.saldo, m.unidade)}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {formatarBRL(m.precoUnitario)}/{m.unidade === 'tonelada' ? 't' : 'm³'}
                </td>
                <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                  {formatarBRL(Math.max(0, Math.round((m.saldo * m.precoUnitario) / 1000)))}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </section>

      <Cartao>
        <TituloSecao>Produção (entulho → material)</TituloSecao>
        <FormularioProducao materiais={opcoes} />
      </Cartao>

      <Cartao>
        <TituloSecao>Entrada de entulho de fora</TituloSecao>
        <FormularioEntrada />
      </Cartao>

      {gestor && (
        <Cartao>
          <TituloSecao>Ajuste de inventário</TituloSecao>
          <FormularioAjuste materiais={opcoes} />
        </Cartao>
      )}

      <section>
        <TituloSecao>Últimas movimentações</TituloSecao>
        {movimentos.length === 0 ? (
          <Cartao>
            <Vazio>Nada registrado ainda.</Vazio>
          </Cartao>
        ) : (
          <Tabela cabecalho={['Data', 'Tipo', 'Item', 'Quantidade', 'Observação']}>
            {movimentos.map((m) => {
              const q = deNumeric(m.quantidade);
              return (
                <tr key={m.id}>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3 whitespace-nowrap">
                    {m.ocorridoEm.split('-').reverse().join('/')}
                  </td>
                  <td className="px-4 py-3">
                    <Etiqueta tom={rotuloTipo[m.tipo].tom}>{rotuloTipo[m.tipo].texto}</Etiqueta>
                  </td>
                  <td className="text-navy-700 px-4 py-3 dark:text-white">
                    {m.material ?? 'Entulho bruto'}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold whitespace-nowrap ${q < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                  >
                    {q > 0 ? '+' : ''}
                    {formatarQuantidade(q, m.unidade ?? 'metro_cubico')}
                  </td>
                  <td className="text-navy-500 dark:text-navy-200 px-4 py-3 text-xs">
                    {m.observacao ?? '—'}
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
