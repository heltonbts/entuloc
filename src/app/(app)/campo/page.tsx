import { Cartao, Vazio } from '@/components/ui';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { CartaoOs } from './cartao-os';
import { osDeCampo } from './consulta';

export const metadata = { title: 'Minhas OS' };
export const dynamic = 'force-dynamic';

const avisos = {
  entrega: 'Entrega registrada. O prazo do cliente começou a contar.',
  retirada: 'Retirada registrada. Agora dê a baixa quando descarregar.',
  baixa: 'Baixa registrada. Caçamba liberada.',
} as const;

const grupos = [
  { etapa: 'entrega', titulo: 'Entregas' },
  { etapa: 'retirada', titulo: 'Retiradas' },
  { etapa: 'baixa', titulo: 'Baixas pendentes' },
] as const;

export default async function PaginaCampo({ searchParams }: PageProps<'/campo'>) {
  const usuario = await exigirPermissaoPagina('coletas.registrar');
  const { feito } = await searchParams;
  const lista = await osDeCampo(usuario);
  const ehGestor = usuario.papel === 'gestor';

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          {ehGestor ? 'OS em campo' : 'Minhas OS'}
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          No endereço, abra a OS e tire a foto: o horário é registrado na hora.
        </p>
      </div>

      {typeof feito === 'string' && feito in avisos && (
        <p
          role="status"
          className="rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {avisos[feito as keyof typeof avisos]}
        </p>
      )}

      {lista.length === 0 ? (
        <Cartao>
          <Vazio>Nenhuma OS pendente. Bom trabalho!</Vazio>
        </Cartao>
      ) : (
        grupos.map(({ etapa, titulo }) => {
          const itens = lista.filter((os) => os.etapa === etapa);
          if (itens.length === 0) return null;
          return (
            <section key={etapa} className="flex flex-col gap-3">
              <h2 className="font-display text-navy-700 text-lg font-bold dark:text-white">
                {titulo} ({itens.length})
              </h2>
              {itens.map((os) => (
                <CartaoOs key={os.id} os={os} mostrarMotorista={ehGestor} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
