/**
 * Inspecao de erros do Postgres.
 *
 * O Drizzle embrulha o erro do driver num DrizzleQueryError cuja `message` so
 * tem o SQL — o nome da constraint e o codigo ficam no `cause`. Checar
 * `erro.message` direto NAO funciona; e preciso andar a cadeia de causas.
 */

/** https://www.postgresql.org/docs/current/errcodes-appendix.html */
export const CODIGO_PG = {
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
} as const;

type ErroPostgres = {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
  cause?: unknown;
};

const PROFUNDIDADE_MAXIMA = 8;

function* cadeiaDeCausas(erro: unknown): Generator<ErroPostgres> {
  let atual = erro;
  const vistos = new Set<unknown>();
  for (let i = 0; i < PROFUNDIDADE_MAXIMA; i++) {
    if (typeof atual !== 'object' || atual === null || vistos.has(atual)) return;
    vistos.add(atual);
    yield atual as ErroPostgres;
    atual = (atual as ErroPostgres).cause;
  }
}

/** Nome da constraint violada, em qualquer nivel da cadeia. */
export function constraintViolada(erro: unknown): string | undefined {
  for (const nivel of cadeiaDeCausas(erro)) {
    if (typeof nivel.constraint === 'string' && nivel.constraint) return nivel.constraint;
    // Fallback: alguns drivers so trazem o nome no texto da mensagem.
    if (typeof nivel.message === 'string') {
      const achado = /violates .*constraint "([^"]+)"/.exec(nivel.message);
      if (achado) return achado[1];
    }
  }
  return undefined;
}

export function codigoPg(erro: unknown): string | undefined {
  for (const nivel of cadeiaDeCausas(erro)) {
    if (typeof nivel.code === 'string' && nivel.code) return nivel.code;
  }
  return undefined;
}

export function violou(erro: unknown, nomeConstraint: string): boolean {
  return constraintViolada(erro) === nomeConstraint;
}
