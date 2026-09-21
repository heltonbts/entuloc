import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { podeAcessar } from '@/lib/dominio/tipos';
import { lerSessao } from '@/server/auth/sessao';
import { registrarNoCampo } from '@/server/campo';
import { validarFoto } from '@/server/fotos';

const coordenada = z.coerce.number().finite().optional();

const esquema = z.object({
  id: z.uuid(),
  etapa: z.enum(['entrega', 'troca', 'retirada', 'baixa']),
  destino: z.enum(['deposito', 'venda']).optional(),
  latitude: coordenada,
  longitude: coordenada,
  capturadoEm: z.coerce.date().optional(),
});

const vazioParaUndefined = (v: FormDataEntryValue | null) =>
  v === null || v === '' ? undefined : v;

/**
 * Recebe os registros do app do motorista. E rota (nao server action) porque
 * a fila offline do celular reenvia sozinha quando o sinal volta e precisa de
 * uma resposta simples: 200 feito, 409 ja estava feito, 4xx erro de verdade.
 */
export async function POST(req: Request) {
  const usuario = await lerSessao();
  if (!usuario || !podeAcessar(usuario.papel, 'coletas.registrar')) {
    return Response.json({ ok: false, erro: 'Sessão expirada. Entre de novo.' }, { status: 401 });
  }

  const form = await req.formData();
  const parsed = esquema.safeParse({
    id: form.get('id'),
    etapa: form.get('etapa'),
    destino: vazioParaUndefined(form.get('destino')),
    latitude: vazioParaUndefined(form.get('latitude')),
    longitude: vazioParaUndefined(form.get('longitude')),
    capturadoEm: vazioParaUndefined(form.get('capturadoEm')),
  });
  if (!parsed.success) {
    return Response.json({ ok: false, erro: 'Dados do registro inválidos.' }, { status: 400 });
  }

  const foto = form.get('foto');
  const erroFoto = validarFoto(foto);
  if (erroFoto) return Response.json({ ok: false, erro: erroFoto }, { status: 400 });

  const fotoRetirada = form.get('fotoRetirada');
  if (parsed.data.etapa === 'troca') {
    const erro = validarFoto(fotoRetirada);
    if (erro) return Response.json({ ok: false, erro }, { status: 400 });
  }

  const resultado = await registrarNoCampo(usuario, {
    ...parsed.data,
    foto: foto as File,
    fotoRetirada: fotoRetirada instanceof File ? fotoRetirada : undefined,
  });

  if (resultado.ok || resultado.jaFeito) {
    for (const rota of ['/campo', '/painel', '/locacoes', '/financeiro', '/cadastros/frota']) {
      revalidatePath(rota);
    }
  }
  const status = resultado.ok ? 200 : resultado.jaFeito ? 409 : 422;
  return Response.json(resultado, { status });
}
