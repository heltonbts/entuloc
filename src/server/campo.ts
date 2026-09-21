import { and, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { cacambas, locacoes, registrosCampo } from '@/db/schema';
import { hojeEmSaoPaulo, momentoDoRegistro } from '@/lib/dominio/locacao';
import { calcularVencimento } from '@/lib/dominio/prazo';
import type { UsuarioSessao } from '@/server/auth/sessao';
import { violou } from '@/server/erros';
import { apurarFechamento, comandosFechamento } from '@/server/fechamento';
import { apagarFoto, salvarFoto } from '@/server/fotos';

export type DadosRegistro = {
  id: string;
  etapa: 'entrega' | 'troca' | 'retirada' | 'baixa';
  destino?: 'deposito' | 'venda';
  latitude?: number;
  longitude?: number;
  /** Hora da foto no celular (vale quando o envio ficou na fila sem sinal). */
  capturadoEm?: Date;
  /** Entrega/troca: cacamba no local. Retirada: cheia recolhida. Baixa: descarte/venda. */
  foto: File;
  /** So na troca: a cacamba cheia sendo recolhida. */
  fotoRetirada?: File;
};

/** `jaFeito`: a etapa ja estava registrada — reenvio da fila, nao e erro para o celular. */
export type ResultadoRegistro = { ok: true } | { ok: false; erro: string; jaFeito?: boolean };

type Locacao = typeof locacoes.$inferSelect;

const jaFeito = (erro: string): ResultadoRegistro => ({ ok: false, erro, jaFeito: true });

async function buscar(id: string): Promise<Locacao | undefined> {
  const [l] = await getDb().select().from(locacoes).where(eq(locacoes.id, id)).limit(1);
  return l;
}

const estaNoCliente = (l: Locacao) => l.status === 'entregue' || l.status === 'retirada_solicitada';

/**
 * Registro do motorista na rua: foto obrigatoria + horario.
 *
 * - entrega: cacamba no endereco -> comeca a contar o prazo.
 * - troca: vazia entra e cheia sai na mesma parada -> fecha a antiga e comeca a nova.
 * - retirada: cacamba recolhida -> fecha a locacao e gera a cobranca.
 * - baixa: entulho descarregado no deposito ou vendido -> cacamba livre.
 */
export async function registrarNoCampo(
  usuario: UsuarioSessao,
  dados: DadosRegistro,
): Promise<ResultadoRegistro> {
  const db = getDb();
  const locacao = await buscar(dados.id);
  if (!locacao) return { ok: false, erro: 'OS não encontrada.' };
  if (locacao.status === 'cancelada') return { ok: false, erro: 'Essa OS foi cancelada.' };
  if (usuario.papel !== 'gestor' && locacao.motoristaId !== usuario.id) {
    return { ok: false, erro: 'Essa OS está com outro motorista.' };
  }

  // Confere a etapa ANTES de subir foto: nao gasta upload com registro invalido.
  let antiga: Locacao | undefined;
  switch (dados.etapa) {
    case 'entrega':
      if (locacao.trocaDeId) return { ok: false, erro: 'Essa OS é de troca.' };
      if (locacao.status !== 'agendada') return jaFeito('A entrega dessa OS já foi registrada.');
      break;
    case 'troca':
      if (!locacao.trocaDeId || !dados.fotoRetirada) {
        return { ok: false, erro: 'A troca precisa das duas fotos.' };
      }
      if (locacao.status !== 'agendada') return jaFeito('Essa troca já foi registrada.');
      antiga = await buscar(locacao.trocaDeId);
      if (!antiga || !estaNoCliente(antiga)) {
        return { ok: false, erro: 'A caçamba a ser trocada não está mais no cliente.' };
      }
      break;
    case 'retirada':
      if (!estaNoCliente(locacao)) return jaFeito('A retirada dessa OS já foi registrada.');
      break;
    case 'baixa':
      if (locacao.destinoEntulho) return jaFeito('A baixa dessa OS já foi feita.');
      if (locacao.status !== 'concluida') return { ok: false, erro: 'Registre a retirada antes.' };
      if (!dados.destino) return { ok: false, erro: 'Informe se foi para o depósito ou vendido.' };
      break;
  }

  const momento = momentoDoRegistro(dados.capturadoEm ?? null, new Date());
  const dia = hojeEmSaoPaulo(momento);
  const recolhida = dados.etapa === 'troca' ? antiga! : locacao;
  if (
    (dados.etapa === 'retirada' || dados.etapa === 'troca') &&
    recolhida.entregaEm &&
    dia < recolhida.entregaEm
  ) {
    return { ok: false, erro: 'A retirada não pode ser anterior à entrega.' };
  }

  const fotos: string[] = [];
  try {
    const pasta = `os/${locacao.numeroOs}`;
    const principal = await salvarFoto(`${pasta}/${dados.etapa}`, dados.foto);
    fotos.push(principal);

    const registro = (locacaoId: string, etapa: 'entrega' | 'retirada' | 'baixa', foto: string) =>
      db.insert(registrosCampo).values({
        locacaoId,
        etapa,
        fotoPathname: foto,
        capturadoEm: momento,
        latitude: dados.latitude?.toFixed(6),
        longitude: dados.longitude?.toFixed(6),
        registradoPorId: usuario.id,
      });

    const entregar = (l: Locacao) => [
      db
        .update(locacoes)
        .set({
          status: 'entregue',
          entregaEm: dia,
          vencimentoEm: calcularVencimento(dia, l.diasContratados, l.contagemPrazo),
          atualizadoEm: new Date(),
        })
        // Condicao de status no UPDATE: toque duplo nao entrega duas vezes.
        .where(and(eq(locacoes.id, l.id), eq(locacoes.status, 'agendada'))),
      db.update(cacambas).set({ status: 'alugada' }).where(eq(cacambas.id, l.cacambaId)),
    ];

    if (dados.etapa === 'entrega') {
      await db.batch([registro(locacao.id, 'entrega', principal), ...entregar(locacao)]);
    } else if (dados.etapa === 'troca') {
      const fotoCheia = await salvarFoto(`${pasta}/troca-recolhida`, dados.fotoRetirada!);
      fotos.push(fotoCheia);
      const apurado = await apurarFechamento(antiga!, dia);
      // Tudo numa transacao: ou a vazia entra E a cheia sai com a cobranca, ou nada.
      // A cheia segue indisponivel ate a baixa, como numa retirada comum.
      await db.batch([
        registro(locacao.id, 'entrega', principal),
        registro(antiga!.id, 'retirada', fotoCheia),
        ...entregar(locacao),
        ...comandosFechamento(antiga!, dia, apurado),
      ]);
    } else if (dados.etapa === 'retirada') {
      const apurado = await apurarFechamento(locacao, dia);
      // A cacamba segue indisponivel (carregada de entulho) ate a baixa.
      await db.batch([
        registro(locacao.id, 'retirada', principal),
        ...comandosFechamento(locacao, dia, apurado),
      ]);
    } else {
      await db.batch([
        registro(locacao.id, 'baixa', principal),
        db
          .update(locacoes)
          .set({ destinoEntulho: dados.destino, atualizadoEm: new Date() })
          .where(eq(locacoes.id, locacao.id)),
        db.update(cacambas).set({ status: 'disponivel' }).where(eq(cacambas.id, locacao.cacambaId)),
      ]);
    }
  } catch (erro) {
    await Promise.all(fotos.map(apagarFoto));
    if (violou(erro, 'registros_campo_etapa_unica')) {
      return jaFeito('Essa etapa já foi registrada.');
    }
    throw erro;
  }

  return { ok: true };
}
