import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '@/db';
import { registrosCampo } from '@/db/schema';
import { podeAcessar } from '@/lib/dominio/tipos';
import { lerSessao } from '@/server/auth/sessao';
import { lerFoto } from '@/server/fotos';

/** Serve a foto privada do Blob so para quem tem acesso a OS. */
export async function GET(_req: Request, { params }: RouteContext<'/fotos/[id]'>) {
  const usuario = await lerSessao();
  if (!usuario || !podeAcessar(usuario.papel, 'locacoes.ver')) {
    return new Response('Não autorizado', { status: 401 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response('Não encontrado', { status: 404 });

  const [registro] = await getDb()
    .select({ pathname: registrosCampo.fotoPathname })
    .from(registrosCampo)
    .where(eq(registrosCampo.id, id))
    .limit(1);
  if (!registro) return new Response('Não encontrado', { status: 404 });

  const foto = await lerFoto(registro.pathname);
  if (!foto) return new Response('Foto não encontrada', { status: 404 });

  return new Response(foto.stream, {
    headers: {
      'Content-Type': foto.blob.contentType,
      // private: nenhum cache compartilhado (CDN, proxy) guarda a foto.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
