import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

/**
 * Cliente do banco com inicializacao preguicosa.
 *
 * `neon()` lanca se DATABASE_URL nao existir, e o Next avalia o topo do modulo
 * durante o build — inicializar aqui quebraria `next build` antes das env vars
 * estarem provisionadas. Nao troque por um Proxy: bibliotecas que inspecionam
 * o objeto do banco (NextAuth, por exemplo) quebram silenciosamente com ele.
 */
function criarDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL nao definida. Rode `vercel env pull .env.local --yes` apos provisionar o Neon.',
    );
  }
  return drizzle(neon(url), { schema });
}

let instancia: ReturnType<typeof criarDb> | null = null;

export function getDb() {
  if (!instancia) instancia = criarDb();
  return instancia;
}

export { schema };
