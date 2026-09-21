import { getTableName, sql, type Column } from 'drizzle-orm';

/**
 * Coluna SEMPRE qualificada com a tabela ("cobrancas"."id").
 *
 * Use em subconsulta correlacionada. Numa consulta de uma tabela so o Drizzle
 * escreve a coluna sem a tabela ("id"), e dentro da subconsulta esse "id"
 * passa a apontar para a tabela de DENTRO — a comparacao vira `x = x` da
 * propria subconsulta e a soma sai errada sem erro nenhum.
 */
export function col(coluna: Column) {
  return sql`${sql.identifier(getTableName(coluna.table))}.${sql.identifier(coluna.name)}`;
}
