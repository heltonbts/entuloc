/**
 * Cria um usuario do sistema.
 *
 *   npm run usuario -- "Nome da Pessoa" email@empresa.com gestor
 *
 * A senha e sorteada e mostrada UMA vez; o usuario e obrigado a troca-la no
 * primeiro acesso. Ninguem — nem quem roda o script — precisa saber a senha
 * definitiva de outra pessoa.
 */
import { eq } from 'drizzle-orm';

import { getDb } from '../src/db';
import { usuarios } from '../src/db/schema';
import { gerarHashSenha, senhaProvisoria } from '../src/server/auth/senha';

async function main() {
  const [nome, email, papelArg] = process.argv.slice(2);

  if (!nome || !email) {
    console.error('Uso: npm run usuario -- "Nome Completo" email@empresa.com [gestor|funcionario]');
    process.exit(1);
  }

  const papel = papelArg === 'gestor' ? 'gestor' : 'funcionario';
  const emailNormalizado = email.trim().toLowerCase();
  const db = getDb();

  const [existente] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, emailNormalizado))
    .limit(1);

  if (existente) {
    console.error(`Já existe usuário com o e-mail ${emailNormalizado}.`);
    process.exit(1);
  }

  const senha = senhaProvisoria();
  await db.insert(usuarios).values({
    nome: nome.trim(),
    email: emailNormalizado,
    senhaHash: await gerarHashSenha(senha),
    papel,
    precisaTrocarSenha: true,
  });

  console.warn('\n  Usuário criado');
  console.warn(`  Nome : ${nome.trim()}`);
  console.warn(`  E-mail: ${emailNormalizado}`);
  console.warn(`  Papel : ${papel}`);
  console.warn(`\n  Senha provisória: ${senha}`);
  console.warn('  (mostrada só agora; será trocada no primeiro acesso)\n');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
