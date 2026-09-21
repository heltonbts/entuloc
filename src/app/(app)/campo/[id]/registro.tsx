'use client';

import { useActionState, useEffect, useState } from 'react';

import { Botao } from '@/components/ui';
import type { EstadoForm } from '@/server/validacao';

import { registrarEtapa } from '../actions';

type Etapa = 'entrega' | 'retirada' | 'baixa';

const textos: Record<Etapa, { foto: string; botao: string }> = {
  entrega: { foto: 'Foto da caçamba no local', botao: 'Confirmar entrega' },
  retirada: { foto: 'Foto da caçamba recolhida', botao: 'Confirmar retirada' },
  baixa: { foto: 'Foto do descarte ou da venda', botao: 'Dar baixa' },
};

/** Lado maior da foto enviada: nitida para comprovar, leve para subir no 4G. */
const LADO_MAXIMO = 1600;

async function reduzirFoto(original: File): Promise<File> {
  const imagem = await createImageBitmap(original);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  canvas.getContext('2d')!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close();

  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
  // Se o navegador nao conseguir reduzir, manda a original — o servidor limita o tamanho.
  return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : original;
}

export function RegistroEtapa({ id, etapa }: { id: string; etapa: Etapa }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(registrarEtapa, {});
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [local, setLocal] = useState<{ lat: number; lng: number } | null>(null);

  // GPS e bonus: se o motorista negar ou o sinal falhar, o registro segue sem.
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setLocal({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }, []);

  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    setPreparando(true);
    try {
      const reduzida = await reduzirFoto(arquivo).catch(() => arquivo);
      setFoto(reduzida);
      setPrevia(URL.createObjectURL(reduzida));
    } finally {
      setPreparando(false);
    }
  }

  return (
    <form
      action={(dados) => {
        if (foto) dados.set('foto', foto);
        acao(dados);
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="etapa" value={etapa} />
      {local && (
        <>
          <input type="hidden" name="latitude" value={local.lat} />
          <input type="hidden" name="longitude" value={local.lng} />
        </>
      )}

      {etapa === 'baixa' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-navy-700 mb-2 text-sm font-medium dark:text-white">
            Para onde foi o entulho?
          </legend>
          {[
            { valor: 'deposito', rotulo: 'Deixei no depósito' },
            { valor: 'venda', rotulo: 'Vendi o entulho' },
          ].map((o) => (
            <label
              key={o.valor}
              className="border-border-subtle has-checked:border-brand-500 has-checked:bg-brand-50 dark:has-checked:bg-navy-800 flex items-center gap-3 rounded-lg border p-4 text-base font-medium"
            >
              <input type="radio" name="destino" value={o.valor} required className="size-5" />
              {o.rotulo}
            </label>
          ))}
        </fieldset>
      )}

      <label className="border-brand-400 bg-brand-50 text-navy-700 dark:bg-navy-800 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center dark:text-white">
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element -- previa local (blob:), nao passa pelo otimizador
          <img src={previa} alt="Prévia da foto" className="max-h-72 rounded-lg object-contain" />
        ) : (
          <span className="text-4xl" aria-hidden>
            📷
          </span>
        )}
        <span className="font-semibold">
          {preparando ? 'Preparando foto…' : previa ? 'Tirar outra foto' : textos[etapa].foto}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => escolherFoto(e.target.files?.[0])}
        />
      </label>

      <p className="text-navy-400 text-xs">
        O horário é registrado automaticamente no envio.{' '}
        {local ? 'Localização capturada.' : 'Sem localização (GPS desligado ou negado).'}
      </p>

      <Botao type="submit" disabled={!foto || enviando || preparando} className="py-4 text-base">
        {enviando ? 'Enviando…' : textos[etapa].botao}
      </Botao>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
