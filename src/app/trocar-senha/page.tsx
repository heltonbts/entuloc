import { Logo } from '@/components/brand/logo';
import { Cartao } from '@/components/ui';
import { exigirSessao } from '@/server/auth/guarda';

import { FormularioTrocaSenha } from './formulario';

export const metadata = { title: 'Trocar senha' };
export const dynamic = 'force-dynamic';

export default async function PaginaTrocarSenha() {
  const usuario = await exigirSessao();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <Cartao>
          <h1 className="font-display text-navy-700 mb-1 text-lg font-bold dark:text-white">
            Trocar senha
          </h1>
          <p className="text-navy-500 dark:text-navy-200 mb-5 text-sm">
            {usuario.precisaTrocarSenha
              ? 'Defina uma senha própria antes de continuar.'
              : `Conectado como ${usuario.email}.`}
          </p>
          <FormularioTrocaSenha />
        </Cartao>
      </div>
    </div>
  );
}
