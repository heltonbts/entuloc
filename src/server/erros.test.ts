import { describe, expect, it } from 'vitest';

import { CODIGO_PG, codigoPg, constraintViolada, violou } from './erros';

/** Reproduz a forma real: DrizzleQueryError -> NeonDbError. */
function erroDrizzle(constraint: string, code = CODIGO_PG.UNIQUE_VIOLATION) {
  const interno = Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    { constraint, code },
  );
  return Object.assign(new Error('Failed query: insert into "cidades" ...'), { cause: interno });
}

describe('constraintViolada', () => {
  it('encontra a constraint dentro do cause, nao na mensagem de fora', () => {
    const erro = erroDrizzle('cidades_nome_uf');
    expect(erro.message).not.toContain('cidades_nome_uf'); // o bug que isso resolve
    expect(constraintViolada(erro)).toBe('cidades_nome_uf');
  });

  it('acha pelo texto quando o driver nao expoe o campo', () => {
    const erro = new Error(
      'duplicate key value violates unique constraint "cacambas_numeracao_unique"',
    );
    expect(constraintViolada(erro)).toBe('cacambas_numeracao_unique');
  });

  it('devolve undefined quando nao e erro de constraint', () => {
    expect(constraintViolada(new Error('timeout'))).toBeUndefined();
    expect(constraintViolada(null)).toBeUndefined();
    expect(constraintViolada('texto solto')).toBeUndefined();
  });

  it('nao entra em loop com cause circular', () => {
    const a: Error & { cause?: unknown } = new Error('a');
    const b: Error & { cause?: unknown } = new Error('b');
    a.cause = b;
    b.cause = a;
    expect(constraintViolada(a)).toBeUndefined();
  });
});

describe('codigoPg', () => {
  it('le o codigo do nivel interno', () => {
    expect(codigoPg(erroDrizzle('x'))).toBe('23505');
  });
});

describe('violou', () => {
  it('compara pelo nome exato', () => {
    const erro = erroDrizzle('cidades_nome_uf');
    expect(violou(erro, 'cidades_nome_uf')).toBe(true);
    expect(violou(erro, 'outra_constraint')).toBe(false);
  });
});
