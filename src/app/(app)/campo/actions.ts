'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getDb } from '@/db';
import { cacambas, locacoes, registrosCampo } from '@/db/schema';
import { hojeEmSaoPaulo } from '@/lib/dominio/locacao';
import { calcularVencimento } from '@/lib/dominio/prazo';
import { exigirPermissao } from '@/server/auth/guarda';
import { violou } from '@/server/erros';
import { apurarFechamento, comandosFechamento } from '@/server/fechamento';
import { apagarFoto, salvarFoto, validarFoto } from '@/server/fotos';
import type { EstadoForm } from '@/server/validacao';

const coordenada = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : undefined))
  .refine((v) => v === undefined || Number.isFinite(v));

const esquema = z.object({
  id: z.uuid(),
  etapa: z.enum(['entrega', 'retirada', 'baixa']),
  destino: z.enum(['deposito', 'venda']).optional(),
  latitude: coordenada,
  longitude: coordenada,
});

/**
 * Registro do motorista na rua: foto obrigatoria + horario do servidor.
 *
 * - entrega: caçamba no endereco -> comeca a contar o prazo.
 * - retirada: caçamba recolhida -> fecha a locacao e gera a cobranca.
 * - baixa: entulho descarregado no deposito ou vendido -> caçamba livre.
 */
export async function registrarEtapa(_estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = await exigirPermissao('coletas.registrar');

  const parsed = esquema.safeParse({
    id: form.get('id'),
    etapa: form.get('etapa'),
    destino: form.get('destino') || undefined,
    latitude: form.get('latitude') || undefined,
    longitude: form.get('longitude') || undefined,
  });
  if (!parsed.success) return { ok: false, erro: 'Dados do registro inválidos.' };
  const { id, etapa, destino, latitude, longitude } = parsed.data;

  const foto = form.get('foto');
  const erroFoto = validarFoto(foto);
  if (erroFoto) return { ok: false, erro: erroFoto };

  const db = getDb();
  const [locacao] = await db.select().from(locacoes).where(eq(locacoes.id, id)).limit(1);
  if (!locacao) return { ok: false, erro: 'OS não encontrada.' };
  if (usuario.papel !== 'gestor' && locacao.motoristaId !== usuario.id) {
    return { ok: false, erro: 'Essa OS está com outro motorista.' };
  }

  // Confere a etapa ANTES de subir a foto: nao gasta upload com registro invalido.
  if (etapa === 'entrega' && locacao.status !== 'agendada') {
    return { ok: false, erro: 'A entrega dessa OS já foi registrada.' };
  }
  if (
    etapa === 'retirada' &&
    locacao.status !== 'entregue' &&
    locacao.status !== 'retirada_solicitada'
  ) {
    return { ok: false, erro: 'Essa caçamba não está no cliente.' };
  }
  if (etapa === 'baixa') {
    if (locacao.status !== 'concluida') return { ok: false, erro: 'Registre a retirada antes.' };
    if (locacao.destinoEntulho) return { ok: false, erro: 'A baixa dessa OS já foi feita.' };
    if (!destino) return { ok: false, erro: 'Informe se foi para o depósito ou vendido.' };
  }

  const hoje = hojeEmSaoPaulo();
  if (etapa === 'retirada' && locacao.entregaEm && hoje < locacao.entregaEm) {
    return { ok: false, erro: 'A retirada não pode ser anterior à entrega.' };
  }

  const fotoPathname = await salvarFoto(`os/${locacao.numeroOs}/${etapa}`, foto as File);
  const registro = db.insert(registrosCampo).values({
    locacaoId: locacao.id,
    etapa,
    fotoPathname,
    latitude: latitude?.toFixed(6),
    longitude: longitude?.toFixed(6),
    registradoPorId: usuario.id,
  });

  try {
    if (etapa === 'entrega') {
      const vencimentoEm = calcularVencimento(hoje, locacao.diasContratados, locacao.contagemPrazo);
      await db.batch([
        registro,
        db
          .update(locacoes)
          .set({ status: 'entregue', entregaEm: hoje, vencimentoEm, atualizadoEm: new Date() })
          // A condicao de status evita dupla entrega se o botao for tocado duas vezes.
          .where(and(eq(locacoes.id, locacao.id), eq(locacoes.status, 'agendada'))),
        db.update(cacambas).set({ status: 'alugada' }).where(eq(cacambas.id, locacao.cacambaId)),
      ]);
    } else if (etapa === 'retirada') {
      const apurado = await apurarFechamento(locacao, hoje);
      // A caçamba segue indisponivel (carregada de entulho) ate a baixa.
      await db.batch([registro, ...comandosFechamento(locacao, hoje, apurado)]);
    } else {
      await db.batch([
        registro,
        db
          .update(locacoes)
          .set({ destinoEntulho: destino, atualizadoEm: new Date() })
          .where(eq(locacoes.id, locacao.id)),
        db.update(cacambas).set({ status: 'disponivel' }).where(eq(cacambas.id, locacao.cacambaId)),
      ]);
    }
  } catch (erro) {
    await apagarFoto(fotoPathname);
    if (violou(erro, 'registros_campo_etapa_unica')) {
      return { ok: false, erro: 'Essa etapa já foi registrada.' };
    }
    throw erro;
  }

  revalidatePath('/campo');
  revalidatePath('/painel');
  revalidatePath('/locacoes');
  revalidatePath('/financeiro');
  revalidatePath('/cadastros/frota');
  redirect(`/campo?feito=${etapa}`);
}
