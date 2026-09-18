import { describe, expect, it } from 'vitest';

import { conferirSenha, gerarHashSenha } from './senha';

describe('hash de senha', () => {
  it('confere a senha correta', async () => {
    const hash = await gerarHashSenha('senha-do-gestor-123');
    expect(await conferirSenha('senha-do-gestor-123', hash)).toBe(true);
  });

  it('recusa senha errada', async () => {
    const hash = await gerarHashSenha('senha-do-gestor-123');
    expect(await conferirSenha('senha-do-gestor-124', hash)).toBe(false);
    expect(await conferirSenha('', hash)).toBe(false);
  });

  it('nunca guarda a senha em claro', async () => {
    const hash = await gerarHashSenha('minha-senha-secreta');
    expect(hash).not.toContain('minha-senha-secreta');
  });

  it('salt diferente a cada chamada: hashes iguais nao vazam senhas iguais', async () => {
    const a = await gerarHashSenha('mesma-senha-aqui');
    const b = await gerarHashSenha('mesma-senha-aqui');
    expect(a).not.toBe(b);
    expect(await conferirSenha('mesma-senha-aqui', a)).toBe(true);
    expect(await conferirSenha('mesma-senha-aqui', b)).toBe(true);
  });

  it('exige ao menos 8 caracteres', async () => {
    await expect(gerarHashSenha('curta')).rejects.toThrow(/8 caracteres/);
  });

  it('nao quebra com hash malformado', async () => {
    expect(await conferirSenha('x', 'lixo')).toBe(false);
    expect(await conferirSenha('x', '')).toBe(false);
    expect(await conferirSenha('x', 'abc:def')).toBe(false);
  });

  it('normaliza unicode: mesma senha digitada de formas diferentes confere', async () => {
    const hash = await gerarHashSenha('café-senha'); // e + acento combinante
    expect(await conferirSenha('café-senha', hash)).toBe(true); // é composto
  });
});
