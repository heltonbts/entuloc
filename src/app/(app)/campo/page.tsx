import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { AppCampo } from './app-campo';
import { osDeCampo } from './consulta';

export const metadata = { title: 'Minhas OS' };
export const dynamic = 'force-dynamic';

export default async function PaginaCampo() {
  const usuario = await exigirPermissaoPagina('coletas.registrar');
  const lista = await osDeCampo(usuario);

  return (
    <AppCampo
      osServidor={lista}
      geradoEm={new Date().toISOString()}
      usuarioId={usuario.id}
      ehGestor={usuario.papel === 'gestor'}
    />
  );
}
