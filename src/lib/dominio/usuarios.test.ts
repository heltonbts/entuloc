import { describe, expect, it } from 'vitest';

import { bloqueioMudanca } from './usuarios';

const gestor = { id: 'g2', papel: 'gestor' as const, ativo: true };
const funcionario = { id: 'f1', papel: 'funcionario' as const, ativo: true };

describe('bloqueioMudanca', () => {
  it('ninguem desativa a si mesmo', () => {
    expect(bloqueioMudanca('g2', gestor, { tipo: 'desativar' }, 3)).toMatch(/próprio acesso/);
  });

  it('ninguem troca o proprio papel', () => {
    expect(
      bloqueioMudanca('g2', gestor, { tipo: 'trocar_papel', novoPapel: 'funcionario' }, 3),
    ).toMatch(/próprio papel/);
  });

  it('nao desativa o ultimo gestor', () => {
    expect(bloqueioMudanca('g1', gestor, { tipo: 'desativar' }, 1)).toMatch(/um gestor ativo/);
  });

  it('nao rebaixa o ultimo gestor', () => {
    expect(
      bloqueioMudanca('g1', gestor, { tipo: 'trocar_papel', novoPapel: 'funcionario' }, 1),
    ).toMatch(/um gestor ativo/);
  });

  it('com outro gestor ativo, pode desativar ou rebaixar', () => {
    expect(bloqueioMudanca('g1', gestor, { tipo: 'desativar' }, 2)).toBeNull();
    expect(
      bloqueioMudanca('g1', gestor, { tipo: 'trocar_papel', novoPapel: 'funcionario' }, 2),
    ).toBeNull();
  });

  it('funcionario pode ser desativado ou promovido', () => {
    expect(bloqueioMudanca('g1', funcionario, { tipo: 'desativar' }, 1)).toBeNull();
    expect(
      bloqueioMudanca('g1', funcionario, { tipo: 'trocar_papel', novoPapel: 'gestor' }, 1),
    ).toBeNull();
  });
});
