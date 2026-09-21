import { del, get, put } from '@vercel/blob';

/**
 * Fotos de campo no Vercel Blob, com acesso PRIVADO: a foto mostra a casa do
 * cliente, entao nunca fica em URL publica. Quem ve passa por /fotos/[id],
 * que exige login.
 */

/** O celular reduz a foto antes de enviar; isto e so a trava do servidor. */
export const TAMANHO_MAXIMO_FOTO = 4 * 1024 * 1024;

export function validarFoto(foto: FormDataEntryValue | null): string | null {
  if (!(foto instanceof File) || foto.size === 0) return 'Tire a foto antes de confirmar.';
  if (!foto.type.startsWith('image/')) return 'O arquivo enviado não é uma imagem.';
  if (foto.size > TAMANHO_MAXIMO_FOTO) return 'A foto ficou grande demais. Tire outra.';
  return null;
}

export async function salvarFoto(pasta: string, foto: File): Promise<string> {
  const extensao = foto.type === 'image/png' ? 'png' : 'jpg';
  const blob = await put(`${pasta}/${Date.now()}.${extensao}`, foto, {
    access: 'private',
    contentType: foto.type,
    addRandomSuffix: true,
  });
  return blob.pathname;
}

/** Desfaz o upload quando a gravacao no banco falha, para nao deixar foto orfa. */
export async function apagarFoto(pathname: string): Promise<void> {
  await del(pathname).catch(() => undefined);
}

export async function lerFoto(pathname: string) {
  const resultado = await get(pathname, { access: 'private' });
  return resultado?.statusCode === 200 ? resultado : null;
}
