import { redirect } from 'next/navigation';

import { podeAcessar, type Permissao } from '@/lib/dominio/tipos';

import { lerSessao, type UsuarioSessao } from './sessao';

/**
 * Guardas de acesso.
 *
 * Checar sessao so no layout NAO protege nada: server actions sao endpoints
 * HTTP proprios e podem ser chamadas direto, sem passar por layout nenhum.
 * Toda action que escreve precisa chamar `exigirPermissao` por conta propria.
 */

export class SemPermissaoError extends Error {
  constructor(permissao: Permissao) {
    super(`Acesso negado: ${permissao}`);
    this.name = 'SemPermissaoError';
  }
}

/** Para paginas: redireciona para o login quando nao ha sessao. */
export async function exigirSessao(): Promise<UsuarioSessao> {
  const usuario = await lerSessao();
  if (!usuario) redirect('/entrar');
  return usuario;
}

/**
 * Para paginas restritas a um papel.
 *
 * Esconder o item do menu NAO protege nada: basta digitar a URL para a pagina
 * renderizar e vazar os dados. Toda pagina restrita chama isto.
 */
export async function exigirPermissaoPagina(permissao: Permissao): Promise<UsuarioSessao> {
  const usuario = await exigirSessao();
  if (!podeAcessar(usuario.papel, permissao)) redirect('/painel?acesso=negado');
  return usuario;
}

/** Para server actions: lanca em vez de redirecionar. */
export async function exigirPermissao(permissao: Permissao): Promise<UsuarioSessao> {
  const usuario = await lerSessao();
  if (!usuario) throw new SemPermissaoError(permissao);
  if (!podeAcessar(usuario.papel, permissao)) throw new SemPermissaoError(permissao);
  return usuario;
}

/** Para esconder o que o usuario nao pode usar. Nao substitui a checagem acima. */
export async function temPermissao(permissao: Permissao): Promise<boolean> {
  const usuario = await lerSessao();
  return usuario ? podeAcessar(usuario.papel, permissao) : false;
}
