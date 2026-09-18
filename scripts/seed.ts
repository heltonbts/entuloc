/**
 * Seed idempotente do catalogo base.
 *
 * Roda com: npm run db:seed
 * So popula o que a EntuLoc definiu como fixo (tipos de cacamba). Cidades,
 * fretes, multas e usuarios sao cadastro do gestor, nao vem no seed.
 */
import { getDb } from '../src/db';
import { tiposCacamba } from '../src/db/schema';

const CATALOGO = [
  {
    id: 'cacamba_4m3',
    nome: 'Caçamba 4 m³',
    volumeM3: '4.00',
    valorLocacao: 50_000, // R$ 500,00
    diasInclusos: 5,
    contagemPrazo: 'uteis' as const,
    ativo: true,
  },
  {
    id: 'mini_conteiner_1_5m3',
    nome: 'Mini contêiner 1,5 m³',
    volumeM3: '1.50',
    valorLocacao: 0, // TODO: valor ainda nao definido pelo gestor
    diasInclusos: 5,
    contagemPrazo: 'uteis' as const,
    ativo: true,
  },
];

async function main() {
  const db = getDb();

  for (const tipo of CATALOGO) {
    await db
      .insert(tiposCacamba)
      .values(tipo)
      .onConflictDoUpdate({
        target: tiposCacamba.id,
        // Preserva o valor ja cadastrado pelo gestor: o seed nao reverte preco.
        set: { nome: tipo.nome, volumeM3: tipo.volumeM3 },
      });
    console.warn(`  ✓ ${tipo.nome}`);
  }

  const total = await db.select().from(tiposCacamba);
  console.warn(`\n${total.length} tipos no catalogo.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
