import { z } from 'zod';

import { parseBps, parseCentavos } from '@/lib/dinheiro';

/** Campo de dinheiro vindo de um <form>: texto livre -> centavos. */
export const dinheiro = z
  .string()
  .min(1, 'Informe o valor')
  .transform((valor, ctx) => {
    try {
      const centavos = parseCentavos(valor);
      if (centavos < 0) {
        ctx.addIssue({ code: 'custom', message: 'O valor não pode ser negativo' });
        return z.NEVER;
      }
      return centavos;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Valor inválido' });
      return z.NEVER;
    }
  });

export const percentual = z
  .string()
  .min(1, 'Informe o percentual')
  .transform((valor, ctx) => {
    try {
      const bps = parseBps(valor);
      if (bps <= 0) {
        ctx.addIssue({ code: 'custom', message: 'O percentual deve ser maior que zero' });
        return z.NEVER;
      }
      return bps;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Percentual inválido' });
      return z.NEVER;
    }
  });

export const inteiroPositivo = z
  .string()
  .min(1, 'Campo obrigatório')
  .transform((valor, ctx) => {
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: 'custom', message: 'Informe um número inteiro maior que zero' });
      return z.NEVER;
    }
    return n;
  });

export const textoObrigatorio = (rotulo: string) =>
  z.string().trim().min(1, `${rotulo} é obrigatório`);

/** Resultado padrao de toda server action, consumido pelo useActionState. */
export type EstadoForm = {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
};

export function erroDeZod(erro: z.ZodError): EstadoForm {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = issue.path[0];
    if (typeof campo === 'string' && !campos[campo]) {
      campos[campo] = issue.message;
    }
  }
  return { ok: false, campos };
}
