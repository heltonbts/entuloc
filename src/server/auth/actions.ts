'use server';

import { eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getDb } from '@/db';
import { telaInicial } from '@/lib/dominio/tipos';
import { usuarios } from '@/db/schema';
import { erroDeZod, type EstadoForm } from '@/server/validacao';

import { conferirSenha, gerarHashSenha } from './senha';
import { criarSessao, encerrarSessao, encerrarTodasSessoes, lerSessao } from './sessao';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail inválido')),
  senha: z.string().min(1, 'Informe a senha'),
});

export async function entrar(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const parsed = esquemaLogin.safeParse({ email: form.get('email'), senha: form.get('senha') });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, parsed.data.email))
    .limit(1);

  // Mensagem unica para e-mail inexistente, senha errada e conta desativada:
  // diferenciar entrega a lista de quem trabalha aqui para quem tentar.
  const generico: EstadoForm = { ok: false, erro: 'E-mail ou senha incorretos.' };

  if (!usuario || !usuario.ativo) {
    // Gasta tempo parecido com o caminho valido, senao da para descobrir
    // quais e-mails existem so medindo a resposta.
    await gerarHashSenha('senha-descartavel-para-igualar-o-tempo');
    return generico;
  }

  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    const minutos = Math.ceil((usuario.bloqueadoAte.getTime() - Date.now()) / 60_000);
    return { ok: false, erro: `Muitas tentativas. Tente novamente em ${minutos} min.` };
  }

  const senhaConfere = await conferirSenha(parsed.data.senha, usuario.senhaHash);

  if (!senhaConfere) {
    const tentativas = usuario.tentativasFalhas + 1;
    await db
      .update(usuarios)
      .set({
        tentativasFalhas: tentativas,
        bloqueadoAte:
          tentativas >= MAX_TENTATIVAS
            ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000)
            : usuario.bloqueadoAte,
      })
      .where(eq(usuarios.id, usuario.id));
    return generico;
  }

  await db
    .update(usuarios)
    .set({ tentativasFalhas: 0, bloqueadoAte: null })
    .where(eq(usuarios.id, usuario.id));

  await criarSessao(usuario.id);
  redirect(usuario.precisaTrocarSenha ? '/trocar-senha' : telaInicial(usuario.papel));
}

export async function sair() {
  await encerrarSessao();
  redirect('/entrar');
}

const esquemaTroca = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: z.string().min(8, 'A nova senha precisa ter ao menos 8 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    message: 'As senhas não conferem',
    path: ['confirmacao'],
  })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    message: 'A nova senha precisa ser diferente da atual',
    path: ['novaSenha'],
  });

export async function trocarSenha(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sessao = await lerSessao();
  if (!sessao) redirect('/entrar');

  const parsed = esquemaTroca.safeParse({
    senhaAtual: form.get('senhaAtual'),
    novaSenha: form.get('novaSenha'),
    confirmacao: form.get('confirmacao'),
  });
  if (!parsed.success) return erroDeZod(parsed.error);

  const db = getDb();
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, sessao.id)).limit(1);
  if (!usuario) redirect('/entrar');

  if (!(await conferirSenha(parsed.data.senhaAtual, usuario.senhaHash))) {
    return { ok: false, campos: { senhaAtual: 'Senha atual incorreta' } };
  }

  await db
    .update(usuarios)
    .set({
      senhaHash: await gerarHashSenha(parsed.data.novaSenha),
      precisaTrocarSenha: false,
      atualizadoEm: sql`now()`,
    })
    .where(eq(usuarios.id, usuario.id));

  // Troca de senha derruba as outras sessoes: se alguem tinha roubado o
  // cookie, perde o acesso agora.
  await encerrarTodasSessoes(usuario.id);
  await criarSessao(usuario.id);

  redirect(telaInicial(usuario.papel));
}
