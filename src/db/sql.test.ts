import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { materiais, movimentosEstoque } from './schema';
import { col } from './sql';

const dialeto = new PgDialect();

describe('col', () => {
  it('sempre escreve a tabela junto da coluna', () => {
    expect(dialeto.sqlToQuery(col(materiais.id)).sql).toBe('"materiais"."id"');
  });

  it('na subconsulta correlacionada, cada lado aponta para a sua tabela', () => {
    const sub = sql`(select 1 from ${movimentosEstoque} where ${col(movimentosEstoque.materialId)} = ${col(materiais.id)})`;
    expect(dialeto.sqlToQuery(sub).sql).toContain(
      '"movimentos_estoque"."material_id" = "materiais"."id"',
    );
  });
});
