import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/* ------------------------------ Botao ------------------------------ */

type BotaoProps = ComponentProps<'button'> & {
  variante?: 'primario' | 'secundario' | 'perigo';
};

const variantes = {
  // Texto navy sobre o laranja da marca: 6.36:1 de contraste (AA).
  primario: 'bg-brand-500 text-navy-900 hover:bg-brand-400',
  secundario:
    'border border-border-subtle bg-surface text-navy-700 hover:bg-navy-50 dark:text-white dark:hover:bg-navy-800',
  perigo:
    'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400',
} as const;

export function Botao({ variante = 'primario', className, ...props }: BotaoProps) {
  return (
    <button
      className={cn(
        'focus-visible:outline-brand-600 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        variantes[variante],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------ Campo ------------------------------ */

type CampoProps = ComponentProps<'input'> & {
  label: string;
  dica?: string;
  erro?: string;
  prefixo?: string;
};

export function Campo({ label, dica, erro, prefixo, className, id, ...props }: CampoProps) {
  const campoId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-navy-700 text-sm font-medium dark:text-white">
        {label}
      </label>
      <div className="relative">
        {prefixo && (
          <span className="text-navy-400 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
            {prefixo}
          </span>
        )}
        <input
          id={campoId}
          className={cn(
            'border-border-subtle bg-surface text-foreground focus:border-brand-500 focus:ring-brand-500/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none',
            prefixo && 'pl-10',
            erro && 'border-red-500',
            className,
          )}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${campoId}-erro` : undefined}
          {...props}
        />
      </div>
      {erro ? (
        <p id={`${campoId}-erro`} className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      ) : (
        dica && <p className="text-navy-400 text-xs">{dica}</p>
      )}
    </div>
  );
}

/* ------------------------------ Select ------------------------------ */

type SelectProps = ComponentProps<'select'> & { label: string; dica?: string };

export function Select({ label, dica, className, id, children, ...props }: SelectProps) {
  const campoId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-navy-700 text-sm font-medium dark:text-white">
        {label}
      </label>
      <select
        id={campoId}
        className={cn(
          'border-border-subtle bg-surface text-foreground focus:border-brand-500 focus:ring-brand-500/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {dica && <p className="text-navy-400 text-xs">{dica}</p>}
    </div>
  );
}

/* ------------------------------ Cartao ------------------------------ */

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-border-subtle bg-surface rounded-xl border p-5', className)}>
      {children}
    </div>
  );
}

export function TituloSecao({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="font-display text-navy-700 text-lg font-bold dark:text-white">{children}</h2>
      {acao}
    </div>
  );
}

/* ------------------------------ Tabela ------------------------------ */

export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="border-border-subtle bg-surface overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border-subtle text-navy-500 dark:text-navy-200 border-b text-left">
            {cabecalho.map((titulo) => (
              <th key={titulo} className="px-4 py-3 font-semibold whitespace-nowrap">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border-subtle divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-navy-400 px-4 py-8 text-center text-sm">{children}</p>;
}

/* ------------------------------ Etiqueta ------------------------------ */

const tonsEtiqueta = {
  neutro: 'bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-100',
  sucesso: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  alerta: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  marca: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200',
  perigo: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
} as const;

export function Etiqueta({
  children,
  tom = 'neutro',
}: {
  children: ReactNode;
  tom?: keyof typeof tonsEtiqueta;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tonsEtiqueta[tom],
      )}
    >
      {children}
    </span>
  );
}
