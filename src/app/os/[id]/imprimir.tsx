'use client';

import { Botao } from '@/components/ui';

export function BotaoImprimir() {
  return (
    <Botao type="button" onClick={() => window.print()}>
      Imprimir OS
    </Botao>
  );
}
