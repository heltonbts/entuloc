import { asc, count, inArray } from 'drizzle-orm';

import { Cartao, Etiqueta, Tabela, TituloSecao } from '@/components/ui';
import { getDb } from '@/db';
import { locacoes, usuarios } from '@/db/schema';
import { STATUS_ATIVOS } from '@/lib/dominio/locacao';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { alternarAtivo } from './actions';
import { FormularioUsuario, RedefinirSenha, SeletorPapel } from './formulario';

export const metadata = { title: 'Usuários' };
export const dynamic = 'force-dynamic';

export default async function PaginaUsuarios() {
  const eu = await exigirPermissaoPagina('usuarios.gerenciar');
  const db = getDb();

  const [lista, osPorMotorista] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        papel: usuarios.papel,
        ativo: usuarios.ativo,
        precisaTrocarSenha: usuarios.precisaTrocarSenha,
        bloqueadoAte: usuarios.bloqueadoAte,
      })
      .from(usuarios)
      .orderBy(asc(usuarios.nome)),
    db
      .select({ motoristaId: locacoes.motoristaId, n: count() })
      .from(locacoes)
      .where(inArray(locacoes.status, [...STATUS_ATIVOS]))
      .groupBy(locacoes.motoristaId),
  ]);
  const osAbertas = new Map(osPorMotorista.map((o) => [o.motoristaId, o.n]));
  const agora = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          Usuários
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          Funcionários recebem as OS no celular em “Minhas OS”. Gestores configuram preços e veem o
          financeiro.
        </p>
      </div>

      <Cartao>
        <TituloSecao>Novo usuário</TituloSecao>
        <FormularioUsuario />
      </Cartao>

      <section>
        <TituloSecao>{lista.length} usuário(s)</TituloSecao>
        <Tabela cabecalho={['Nome', 'Papel', 'Situação', 'OS abertas', 'Ações']}>
          {lista.map((u) => {
            const souEu = u.id === eu.id;
            const bloqueado = u.bloqueadoAte !== null && u.bloqueadoAte > agora;
            const abertas = osAbertas.get(u.id) ?? 0;
            return (
              <tr key={u.id} className={u.ativo ? undefined : 'opacity-60'}>
                <td className="px-4 py-3">
                  <span className="text-navy-700 block font-medium dark:text-white">
                    {u.nome}
                    {souEu && <span className="text-navy-400 font-normal"> (você)</span>}
                  </span>
                  <span className="text-navy-400 text-xs">{u.email}</span>
                </td>
                <td className="px-4 py-3">
                  {souEu || !u.ativo ? (
                    <span className="text-navy-500 dark:text-navy-200 text-xs capitalize">
                      {u.papel}
                    </span>
                  ) : (
                    <SeletorPapel id={u.id} papel={u.papel} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {!u.ativo ? (
                      <Etiqueta>Desativado</Etiqueta>
                    ) : bloqueado ? (
                      <Etiqueta tom="perigo">Bloqueado</Etiqueta>
                    ) : u.precisaTrocarSenha ? (
                      <Etiqueta tom="alerta">Aguardando 1º acesso</Etiqueta>
                    ) : (
                      <Etiqueta tom="sucesso">Ativo</Etiqueta>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-navy-500 dark:text-navy-200">{abertas}</span>
                  {!u.ativo && abertas > 0 && (
                    <span className="block text-xs text-red-600 dark:text-red-400">
                      Passe para outro motorista em Locações
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!souEu && (
                    <div className="flex flex-col items-start gap-2">
                      {u.ativo && <RedefinirSenha id={u.id} />}
                      <form action={alternarAtivo}>
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          type="hidden"
                          name="valor"
                          value={u.ativo ? 'desativar' : 'ativar'}
                        />
                        <button
                          type="submit"
                          className={
                            u.ativo
                              ? 'text-xs font-medium text-red-600 underline underline-offset-2 dark:text-red-400'
                              : 'text-brand-600 text-xs font-medium underline underline-offset-2'
                          }
                        >
                          {u.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </section>
    </div>
  );
}
