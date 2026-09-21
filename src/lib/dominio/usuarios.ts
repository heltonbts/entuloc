import type { Papel } from './tipos';

type Alvo = { id: string; papel: Papel; ativo: boolean };

export type MudancaUsuario = { tipo: 'desativar' } | { tipo: 'trocar_papel'; novoPapel: Papel };

/**
 * Trava mudancas que trancariam a empresa fora do sistema: sem gestor ativo
 * ninguem mais cria usuario, redefine senha nem ve o financeiro.
 * Devolve a mensagem de erro, ou `null` se a mudanca pode seguir.
 */
export function bloqueioMudanca(
  atorId: string,
  alvo: Alvo,
  mudanca: MudancaUsuario,
  gestoresAtivos: number,
): string | null {
  if (atorId === alvo.id) {
    return mudanca.tipo === 'desativar'
      ? 'Você não pode desativar o próprio acesso.'
      : 'Você não pode mudar o próprio papel.';
  }

  const tiraUmGestor =
    alvo.papel === 'gestor' &&
    alvo.ativo &&
    (mudanca.tipo === 'desativar' || mudanca.novoPapel !== 'gestor');
  if (tiraUmGestor && gestoresAtivos <= 1) {
    return 'É preciso manter ao menos um gestor ativo.';
  }

  return null;
}
