'use server';

import { and, count, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/db';
import { usuarios } from '@/db/schema';
import { bloqueioMudanca, type MudancaUsuario } from '@/lib/dominio/usuarios';
import { exigirPermissao } from '@/server/auth/guarda';
import { gerarHashSenha, senhaProvisoria } from '@/server/auth/senha';
import { encerrarTodasSessoes } from '@/server/auth/sessao';
import { violou } from '@/server/erros';
import { erroDeZod, textoObrigatorio, type EstadoForm } from '@/server/validacao';

/** Resultado que carrega a senha provisoria para mostrar UMA vez na tela. */
export type EstadoSenha = EstadoForm & { senha?: string; para?: string };

const papel = z.enum(['gestor', 'funcionario']);

const esquemaNovo = z.object({
  nome: textoObrigatorio('Nome'),
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail inválido')),
  papel,
});

export async function criarUsuario(_estado: EstadoSenha, form: FormData): Promise<EstadoSenha> {
  await exigirPermissao('usuarios.gerenciar');

  const parsed = esquemaNovo.safeParse({
    nome: form.get('nome'),
    email: form.get('email'),
    papel: form.get('papel'),
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  const senha = senhaProvisoria();
  try {
    await getDb()
      .insert(usuarios)
      .values({ ...parsed.data, senhaHash: await gerarHashSenha(senha), precisaTrocarSenha: true });
  } catch (erro) {
    if (violou(erro, 'usuarios_email_unique')) {
      return { ok: false, campos: { email: 'Já existe usuário com esse e-mail.' } };
    }
    throw erro;
  }

  revalidatePath('/usuarios');
  return { ok: true, senha, para: parsed.data.nome };
}

/**
 * Esqueceu a senha ou foi bloqueado por tentativas: gera outra provisoria,
 * desbloqueia e derruba as sessoes abertas (celular perdido, por exemplo).
 */
export async function redefinirSenha(_estado: EstadoSenha, form: FormData): Promise<EstadoSenha> {
  const ator = await exigirPermissao('usuarios.gerenciar');

  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { ok: false, erro: 'Usuário inválido.' };
  if (id.data === ator.id) {
    return { ok: false, erro: 'Para a sua própria senha, use "Trocar senha".' };
  }

  const senha = senhaProvisoria();
  const [alvo] = await getDb()
    .update(usuarios)
    .set({
      senhaHash: await gerarHashSenha(senha),
      precisaTrocarSenha: true,
      tentativasFalhas: 0,
      bloqueadoAte: null,
      atualizadoEm: new Date(),
    })
    .where(eq(usuarios.id, id.data))
    .returning({ nome: usuarios.nome });
  if (!alvo) return { ok: false, erro: 'Usuário não encontrado.' };

  await encerrarTodasSessoes(id.data);
  revalidatePath('/usuarios');
  return { ok: true, senha, para: alvo.nome };
}

async function aplicarMudanca(form: FormData, montar: (valor: string) => MudancaUsuario | null) {
  const ator = await exigirPermissao('usuarios.gerenciar');

  const parsed = z
    .object({ id: z.uuid(), valor: z.string() })
    .safeParse({ id: form.get('id'), valor: form.get('valor') });
  if (!parsed.success) return;
  const mudanca = montar(parsed.data.valor);

  const db = getDb();
  const [alvo] = await db
    .select({ id: usuarios.id, papel: usuarios.papel, ativo: usuarios.ativo })
    .from(usuarios)
    .where(eq(usuarios.id, parsed.data.id))
    .limit(1);
  if (!alvo) return;

  if (mudanca) {
    const [gestores] = await db
      .select({ n: count() })
      .from(usuarios)
      .where(and(eq(usuarios.papel, 'gestor'), eq(usuarios.ativo, true)));
    // A tela ja esconde essas opcoes; aqui e a trava de verdade.
    if (bloqueioMudanca(ator.id, alvo, mudanca, gestores.n)) return;
  }

  return { db, alvo, mudanca };
}

export async function alternarAtivo(form: FormData): Promise<void> {
  const r = await aplicarMudanca(form, (v) => (v === 'desativar' ? { tipo: 'desativar' } : null));
  if (!r) return;
  const ativo = r.mudanca === null;

  await r.db
    .update(usuarios)
    .set({ ativo, tentativasFalhas: 0, bloqueadoAte: null, atualizadoEm: new Date() })
    .where(eq(usuarios.id, r.alvo.id));
  // Desligado perde o acesso no proximo clique, nao quando a sessao expirar.
  if (!ativo) await encerrarTodasSessoes(r.alvo.id);

  revalidatePath('/usuarios');
  revalidatePath('/locacoes');
}

export async function trocarPapel(form: FormData): Promise<void> {
  const r = await aplicarMudanca(form, (v) => {
    const novo = papel.safeParse(v);
    return novo.success ? { tipo: 'trocar_papel', novoPapel: novo.data } : null;
  });
  if (!r?.mudanca || r.mudanca.tipo !== 'trocar_papel') return;

  await r.db
    .update(usuarios)
    .set({ papel: r.mudanca.novoPapel, atualizadoEm: new Date() })
    .where(eq(usuarios.id, r.alvo.id));
  // Sem derrubar sessao: lerSessao le o papel do banco a cada request, entao
  // a permissao nova vale no proximo clique.

  revalidatePath('/usuarios');
}
