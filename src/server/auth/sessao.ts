import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, lt } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { getDb } from '@/db';
import { sessoes, usuarios } from '@/db/schema';
import type { Papel } from '@/lib/dominio/tipos';

const NOME_COOKIE = 'entuloc_sessao';
const DURACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  precisaTrocarSenha: boolean;
};

/**
 * O cookie leva o token cru; o banco guarda so o SHA-256 dele.
 * Assim, um dump do banco nao permite forjar sessao de ninguem.
 */
function idDeSessao(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + DURACAO_MS);

  await getDb()
    .insert(sessoes)
    .values({ id: idDeSessao(token), usuarioId, expiraEm });

  const jar = await cookies();
  jar.set(NOME_COOKIE, token, {
    httpOnly: true, // JS da pagina nao le: limita roubo por XSS
    sameSite: 'lax', // barra CSRF vindo de outro site
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiraEm,
  });
}

export async function lerSessao(): Promise<UsuarioSessao | null> {
  const jar = await cookies();
  const token = jar.get(NOME_COOKIE)?.value;
  if (!token) return null;

  const linhas = await getDb()
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      papel: usuarios.papel,
      ativo: usuarios.ativo,
      precisaTrocarSenha: usuarios.precisaTrocarSenha,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id))
    .where(and(eq(sessoes.id, idDeSessao(token)), gt(sessoes.expiraEm, new Date())))
    .limit(1);

  const usuario = linhas[0];
  // Usuario desativado perde acesso na hora, mesmo com sessao valida.
  if (!usuario || !usuario.ativo) return null;

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    precisaTrocarSenha: usuario.precisaTrocarSenha,
  };
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(NOME_COOKIE)?.value;
  if (token) {
    await getDb()
      .delete(sessoes)
      .where(eq(sessoes.id, idDeSessao(token)));
  }
  jar.delete(NOME_COOKIE);
}

/** Derruba todas as sessoes do usuario (troca de senha, desligamento). */
export async function encerrarTodasSessoes(usuarioId: string): Promise<void> {
  await getDb().delete(sessoes).where(eq(sessoes.usuarioId, usuarioId));
}

export async function limparSessoesExpiradas(): Promise<number> {
  const removidas = await getDb()
    .delete(sessoes)
    .where(lt(sessoes.expiraEm, new Date()))
    .returning({ id: sessoes.id });
  return removidas.length;
}
