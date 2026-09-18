import Image from 'next/image';

import { cn } from '@/lib/cn';

type LogoTone = 'auto' | 'light' | 'dark' | 'onBrand';

const wordmarkTones: Record<LogoTone, { entu: string; loc: string; tagline: string }> = {
  // Acompanha o tema do sistema (claro/escuro).
  auto: {
    entu: 'text-navy-700 dark:text-white',
    loc: 'text-brand-500 dark:text-brand-400',
    tagline: 'text-navy-500 dark:text-navy-200',
  },
  light: { entu: 'text-navy-700', loc: 'text-brand-500', tagline: 'text-navy-500' },
  dark: { entu: 'text-white', loc: 'text-brand-400', tagline: 'text-navy-200' },
  // Sobre o laranja da marca, como no logotipo original.
  onBrand: { entu: 'text-white', loc: 'text-navy-700', tagline: 'text-navy-700' },
};

const sizes = {
  sm: { symbol: 28, text: 'text-lg', tagline: 'text-[7px]', gap: 'gap-2' },
  md: { symbol: 40, text: 'text-2xl', tagline: 'text-[9px]', gap: 'gap-2.5' },
  lg: { symbol: 64, text: 'text-4xl', tagline: 'text-[13px]', gap: 'gap-3.5' },
} as const;

export type LogoProps = {
  tone?: LogoTone;
  size?: keyof typeof sizes;
  showTagline?: boolean;
  symbolOnly?: boolean;
  className?: string;
};

export function Logo({
  tone = 'auto',
  size = 'md',
  showTagline = false,
  symbolOnly = false,
  className,
}: LogoProps) {
  const s = sizes[size];
  const colors = wordmarkTones[tone];

  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <Image
        src="/brand/entuloc-simbolo.png"
        alt="EntuLoc"
        width={s.symbol}
        height={s.symbol}
        className="rounded-lg"
        priority
      />
      {!symbolOnly && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-display font-extrabold tracking-tight', s.text)}>
            <span className={colors.entu}>ENTU</span>
            <span className={colors.loc}>LOC</span>
          </span>
          {showTagline && (
            <span
              className={cn(
                'font-display mt-1 font-semibold tracking-[0.18em] uppercase',
                s.tagline,
                colors.tagline,
              )}
            >
              Coleta e reciclagem de entulho
            </span>
          )}
        </span>
      )}
    </span>
  );
}
