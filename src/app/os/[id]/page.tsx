import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { Logo } from '@/components/brand/logo';
import { getDb } from '@/db';
import {
  cacambas,
  cidades,
  clientes,
  locacoes,
  registrosCampo,
  regrasMulta,
  tiposCacamba,
  usuarios,
} from '@/db/schema';
import { formatarBRL, formatarPercentual } from '@/lib/dinheiro';
import { formatarDocumento } from '@/lib/documento';
import { exigirPermissaoPagina } from '@/server/auth/guarda';

import { BotaoImprimir } from './imprimir';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ordem de Serviço' };

function formatarData(data: string | null): string {
  if (!data) return '____/____/______';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

type Regra = typeof regrasMulta.$inferSelect;

function descreverMulta(regra: Regra | null): string {
  if (!regra) return 'Sem multa por atraso.';
  const valor =
    regra.base === 'percentual'
      ? `${formatarPercentual(regra.percentualBps ?? 0)} do valor da locação`
      : formatarBRL(regra.valorFixo ?? 0);
  const partes = [
    `${valor} ${regra.cobranca === 'por_dia' ? 'por dia de atraso' : 'uma única vez'}`,
  ];
  if (regra.diasCarencia > 0) partes.push(`após ${regra.diasCarencia} dia(s) de carência`);
  if (regra.tetoMaximo) partes.push(`limitada a ${formatarBRL(regra.tetoMaximo)}`);
  return `Multa: ${partes.join(', ')}. O atraso para de contar no pedido de retirada.`;
}

const nomeEtapa = { entrega: 'Entrega', retirada: 'Retirada', baixa: 'Baixa' } as const;

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-navy-200 break-inside-avoid rounded-lg border p-4">
      <h2 className="text-navy-500 mb-2 text-xs font-bold tracking-wider uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-navy-500 shrink-0">{rotulo}:</span>
      <span className="text-navy-800 font-medium">{valor}</span>
    </div>
  );
}

function Assinaturas({ titulo }: { titulo: string }) {
  return (
    <Bloco titulo={titulo}>
      <p className="text-navy-800 text-sm">Data: ____/____/______ &nbsp;&nbsp; Hora: ____:____</p>
      <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs">
        <div className="border-navy-400 text-navy-500 border-t pt-1">Responsável EntuLoc</div>
        <div className="border-navy-400 text-navy-500 border-t pt-1">
          Cliente / responsável no local
        </div>
      </div>
    </Bloco>
  );
}

export default async function PaginaOrdemServico({ params }: PageProps<'/os/[id]'>) {
  const usuario = await exigirPermissaoPagina('locacoes.ver');
  // Fora do layout (app), entao repete a trava de senha provisoria.
  if (usuario.precisaTrocarSenha) redirect('/trocar-senha');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  const [os] = await db
    .select({
      locacao: locacoes,
      cliente: clientes,
      numeracao: cacambas.numeracao,
      tipo: tiposCacamba.nome,
      volume: tiposCacamba.volumeM3,
      cidade: cidades.nome,
      uf: cidades.uf,
      regra: regrasMulta,
      motorista: usuarios.nome,
    })
    .from(locacoes)
    .innerJoin(clientes, eq(locacoes.clienteId, clientes.id))
    .innerJoin(cacambas, eq(locacoes.cacambaId, cacambas.id))
    .innerJoin(tiposCacamba, eq(cacambas.tipoId, tiposCacamba.id))
    .innerJoin(cidades, eq(locacoes.cidadeId, cidades.id))
    .leftJoin(regrasMulta, eq(locacoes.regraMultaId, regrasMulta.id))
    .leftJoin(usuarios, eq(locacoes.motoristaId, usuarios.id))
    .where(eq(locacoes.id, id))
    .limit(1);
  if (!os) notFound();

  const registros = await db
    .select()
    .from(registrosCampo)
    .where(eq(registrosCampo.locacaoId, id))
    .orderBy(asc(registrosCampo.registradoEm));

  const { locacao, cliente } = os;
  const numero = String(locacao.numeroOs).padStart(6, '0');
  const emitidaEm = locacao.criadoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const total = locacao.valorLocacao + locacao.valorFrete;

  return (
    <div className="bg-navy-50 min-h-full py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Link
          href="/locacoes"
          className="text-navy-500 hover:text-brand-600 text-sm font-medium underline underline-offset-2"
        >
          ← Voltar para locações
        </Link>
        <BotaoImprimir />
      </div>

      <article className="mx-auto flex max-w-3xl flex-col gap-4 bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="border-navy-200 flex items-start justify-between gap-4 border-b pb-4">
          <Logo size="md" tone="light" showTagline />
          <div className="text-right">
            <p className="text-navy-500 text-xs font-bold tracking-wider uppercase">
              Ordem de Serviço
            </p>
            <p className="font-display text-navy-800 text-3xl font-extrabold">Nº {numero}</p>
            <p className="text-navy-500 text-xs">Emitida em {emitidaEm}</p>
            <p className="text-navy-500 text-xs">Motorista: {os.motorista ?? '—'}</p>
          </div>
        </header>

        {locacao.status === 'cancelada' && (
          <p className="rounded-lg border-2 border-red-600 px-4 py-3 text-center font-bold text-red-700">
            OS CANCELADA — {locacao.motivoCancelamento}
          </p>
        )}

        <Bloco titulo="Cliente">
          <p className="text-navy-800 font-semibold">{cliente.nome}</p>
          <div className="mt-1 grid gap-1 sm:grid-cols-2 print:grid-cols-2">
            {cliente.documento && (
              <Linha
                rotulo={cliente.tipoPessoa === 'juridica' ? 'CNPJ' : 'CPF'}
                valor={formatarDocumento(cliente.documento)}
              />
            )}
            {cliente.telefone && <Linha rotulo="Telefone" valor={cliente.telefone} />}
            <Linha
              rotulo="Endereço"
              valor={`${cliente.endereco} — ${cliente.cidade}/${cliente.uf}`}
            />
          </div>
        </Bloco>

        <Bloco titulo="Local da caçamba">
          <p className="text-navy-800 font-semibold">
            {locacao.enderecoEntrega} — {os.cidade}/{os.uf}
          </p>
          {locacao.observacoes && (
            <p className="text-navy-700 mt-1 text-sm">Obs.: {locacao.observacoes}</p>
          )}
        </Bloco>

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <Bloco titulo="Caçamba">
            <Linha rotulo="Numeração" valor={os.numeracao} />
            <Linha
              rotulo="Tipo"
              valor={`${os.tipo} (${Number(os.volume).toLocaleString('pt-BR')} m³)`}
            />
          </Bloco>
          <Bloco titulo="Prazo">
            <Linha
              rotulo="Período"
              valor={`${locacao.diasContratados} dias ${locacao.contagemPrazo === 'uteis' ? 'úteis' : 'corridos'}`}
            />
            <Linha rotulo="Entrega" valor={formatarData(locacao.entregaEm)} />
            <Linha rotulo="Vencimento" valor={formatarData(locacao.vencimentoEm)} />
          </Bloco>
        </div>

        <Bloco titulo="Valores">
          <div className="flex flex-col gap-1">
            <Linha rotulo="Locação" valor={formatarBRL(locacao.valorLocacao)} />
            <Linha rotulo="Frete" valor={formatarBRL(locacao.valorFrete)} />
            <Linha rotulo="Total" valor={<strong>{formatarBRL(total)}</strong>} />
          </div>
          <p className="text-navy-500 mt-2 text-xs">{descreverMulta(os.regra)}</p>
        </Bloco>

        {registros.length > 0 && (
          <Bloco titulo="Registros de campo">
            <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3">
              {registros.map((r) => (
                <figure key={r.id} className="flex flex-col gap-1 text-xs">
                  <a href={`/fotos/${r.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto privada servida por rota autenticada */}
                    <img
                      src={`/fotos/${r.id}`}
                      alt={`Foto da ${nomeEtapa[r.etapa]}`}
                      className="border-navy-200 aspect-[4/3] w-full rounded border object-cover"
                    />
                  </a>
                  <figcaption className="text-navy-700">
                    <strong>{nomeEtapa[r.etapa]}</strong>
                    {r.etapa === 'baixa' && locacao.destinoEntulho && (
                      <> · {locacao.destinoEntulho === 'venda' ? 'entulho vendido' : 'depósito'}</>
                    )}
                    <br />
                    {r.registradoEm.toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {r.latitude && r.longitude && (
                      <>
                        {' · '}
                        <a
                          href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          local
                        </a>
                      </>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Bloco>
        )}

        <Assinaturas titulo="Entrega da caçamba" />
        <Assinaturas titulo="Retirada da caçamba" />
      </article>
    </div>
  );
}
