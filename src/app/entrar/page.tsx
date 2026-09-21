import { redirect } from 'next/navigation';

import { Logo } from '@/components/brand/logo';
import { Cartao } from '@/components/ui';
import { telaInicial } from '@/lib/dominio/tipos';
import { lerSessao } from '@/server/auth/sessao';

import { FormularioLogin } from './formulario';
import { LimparCopiaOffline } from './limpar-offline';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function PaginaEntrar() {
  const sessao = await lerSessao();
  if (sessao) redirect(telaInicial(sessao.papel));

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <LimparCopiaOffline />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" showTagline />
        </div>
        <Cartao>
          <h1 className="font-display text-navy-700 mb-5 text-lg font-bold dark:text-white">
            Acessar o sistema
          </h1>
          <FormularioLogin />
        </Cartao>
        <p className="text-navy-400 mt-6 text-center text-xs">
          Acesso restrito. Contas são criadas pelo gestor.
        </p>
      </div>
    </div>
  );
}
