'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { Botao, Cartao, Etiqueta, Vazio } from '@/components/ui';

import type { OsCampo } from './consulta';
import { enviarFila, guardarNaFila, listarFila, removerDaFila, type ItemFila } from './fila';

type Etapa = OsCampo['etapa'];

const rotulo: Record<Etapa, { texto: string; tom: 'marca' | 'alerta' | 'neutro' | 'perigo' }> = {
  entrega: { texto: 'Entregar', tom: 'marca' },
  troca: { texto: 'Trocar', tom: 'perigo' },
  retirada: { texto: 'Retirar', tom: 'alerta' },
  baixa: { texto: 'Dar baixa', tom: 'neutro' },
};

const grupos: { etapa: Etapa; titulo: string }[] = [
  { etapa: 'troca', titulo: 'Trocas' },
  { etapa: 'entrega', titulo: 'Entregas' },
  { etapa: 'retirada', titulo: 'Retiradas' },
  { etapa: 'baixa', titulo: 'Baixas pendentes' },
];

/* ------------------------- lista guardada no celular ------------------------- */

type ListaGuardada = { geradoEm: string; lista: OsCampo[] };

const chaveLista = (usuarioId: string) => `entuloc:campo:${usuarioId}`;

function lerListaGuardada(usuarioId: string): string | null {
  try {
    return localStorage.getItem(chaveLista(usuarioId));
  } catch {
    return null;
  }
}

function interpretar(bruto: string | null): ListaGuardada | null {
  try {
    return bruto ? (JSON.parse(bruto) as ListaGuardada) : null;
  } catch {
    return null;
  }
}

const semAssinatura = () => () => undefined;

function assinarConexao(avisar: () => void) {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

function guardarLista(usuarioId: string, dados: ListaGuardada) {
  try {
    localStorage.setItem(chaveLista(usuarioId), JSON.stringify(dados));
  } catch {
    // Sem espaco ou modo privado: segue so com o que veio do servidor.
  }
}

/**
 * O que ainda esta na fila ja conta como feito na tela: o motorista nao deve
 * ver de novo a entrega que acabou de registrar so porque o sinal caiu.
 */
function aplicarFila(lista: OsCampo[], fila: ItemFila[]): OsCampo[] {
  const pendentes = fila.filter((i) => !i.erro);
  return lista.flatMap((os) => {
    const feitos = pendentes.filter((i) => i.id === os.id).map((i) => i.etapa);
    if (feitos.some((e) => e === 'entrega' || e === 'troca' || e === 'baixa')) return [];
    if (feitos.includes('retirada')) return [{ ...os, etapa: 'baixa' as const }];
    return [os];
  });
}

/* --------------------------------- fotos --------------------------------- */

/** Lado maior da foto enviada: nitida para comprovar, leve para subir no 4G. */
const LADO_MAXIMO = 1600;

async function reduzirFoto(original: File): Promise<Blob> {
  try {
    const imagem = await createImageBitmap(original);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    canvas.getContext('2d')!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    imagem.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
    return blob ?? original;
  } catch {
    // Formato que o navegador nao decodifica: manda a original (o servidor limita o tamanho).
    return original;
  }
}

type Foto = { blob: Blob; previa: string; tiradaEm: string };

function CampoFoto({
  titulo,
  foto,
  onFoto,
}: {
  titulo: string;
  foto: Foto | null;
  onFoto: (f: Foto) => void;
}) {
  const [preparando, setPreparando] = useState(false);

  return (
    <label className="border-brand-400 bg-brand-50 text-navy-700 dark:bg-navy-800 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center dark:text-white">
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- previa local (blob:), nao passa pelo otimizador
        <img src={foto.previa} alt={titulo} className="max-h-60 rounded-lg object-contain" />
      ) : (
        <span className="text-4xl" aria-hidden>
          📷
        </span>
      )}
      <span className="font-semibold">
        {preparando ? 'Preparando foto…' : foto ? `${titulo} — tirar outra` : titulo}
      </span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          if (!arquivo) return;
          // Hora da foto, nao do envio: e o que vale se o sinal so voltar depois.
          const tiradaEm = new Date().toISOString();
          setPreparando(true);
          const blob = await reduzirFoto(arquivo);
          setPreparando(false);
          onFoto({ blob, previa: URL.createObjectURL(blob), tiradaEm });
        }}
      />
    </label>
  );
}

/* --------------------------- registro de uma etapa --------------------------- */

function PainelRegistro({
  os,
  usuarioId,
  onGuardado,
  onFechar,
}: {
  os: OsCampo;
  usuarioId: string;
  onGuardado: () => void;
  onFechar: () => void;
}) {
  const [foto, setFoto] = useState<Foto | null>(null);
  const [fotoRetirada, setFotoRetirada] = useState<Foto | null>(null);
  const [destino, setDestino] = useState<'deposito' | 'venda' | null>(null);
  const [local, setLocal] = useState<{ lat: number; lng: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // GPS e bonus: negado ou sem satelite, o registro segue sem.
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setLocal({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(
    () => () => {
      if (foto) URL.revokeObjectURL(foto.previa);
      if (fotoRetirada) URL.revokeObjectURL(fotoRetirada.previa);
    },
    [foto, fotoRetirada],
  );

  const troca = os.etapa === 'troca';
  const pronto =
    foto !== null && (!troca || fotoRetirada !== null) && (os.etapa !== 'baixa' || destino);

  async function confirmar() {
    if (!foto || !pronto) return;
    setSalvando(true);
    setErro(null);
    try {
      await guardarNaFila({
        usuarioId,
        id: os.id,
        numeroOs: os.numeroOs,
        etapa: os.etapa,
        destino: destino ?? undefined,
        latitude: local?.lat,
        longitude: local?.lng,
        // Na troca vale a primeira foto tirada: e quando o caminhao chegou.
        capturadoEm:
          fotoRetirada && fotoRetirada.tiradaEm < foto.tiradaEm
            ? fotoRetirada.tiradaEm
            : foto.tiradaEm,
        foto: foto.blob,
        fotoRetirada: fotoRetirada?.blob,
      });
      onGuardado();
    } catch {
      setErro('Não deu para guardar no celular. Libere espaço e tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {os.etapa === 'baixa' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-navy-700 mb-2 text-sm font-medium dark:text-white">
            Para onde foi o entulho?
          </legend>
          {(
            [
              { valor: 'deposito', texto: 'Deixei no depósito' },
              { valor: 'venda', texto: 'Vendi o entulho' },
            ] as const
          ).map((o) => (
            <label
              key={o.valor}
              className="border-border-subtle has-checked:border-brand-500 has-checked:bg-brand-50 dark:has-checked:bg-navy-800 flex items-center gap-3 rounded-lg border p-4 text-base font-medium"
            >
              <input
                type="radio"
                name={`destino-${os.id}`}
                checked={destino === o.valor}
                onChange={() => setDestino(o.valor)}
                className="size-5"
              />
              {o.texto}
            </label>
          ))}
        </fieldset>
      )}

      <CampoFoto
        titulo={
          troca
            ? `Caçamba vazia ${os.numeracao} no local`
            : os.etapa === 'entrega'
              ? 'Foto da caçamba no local'
              : os.etapa === 'retirada'
                ? 'Foto da caçamba recolhida'
                : 'Foto do descarte ou da venda'
        }
        foto={foto}
        onFoto={setFoto}
      />
      {troca && (
        <CampoFoto
          titulo={`Caçamba cheia ${os.numeracaoRecolhida ?? ''} recolhida`}
          foto={fotoRetirada}
          onFoto={setFotoRetirada}
        />
      )}

      <p className="text-navy-400 text-xs">
        O horário da foto fica registrado mesmo sem sinal.{' '}
        {local ? 'Localização capturada.' : 'Sem localização (GPS desligado ou negado).'}
      </p>

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Botao type="button" variante="secundario" onClick={onFechar} disabled={salvando}>
          Voltar
        </Botao>
        <Botao type="button" onClick={confirmar} disabled={!pronto || salvando} className="py-4">
          {salvando ? 'Guardando…' : `Confirmar — ${rotulo[os.etapa].texto.toLowerCase()}`}
        </Botao>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}

/* ------------------------------- cartao da OS ------------------------------- */

function linkMapa(os: OsCampo) {
  const destino = `${os.endereco}, ${os.cidade} - ${os.uf}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
}

function CartaoOs({
  os,
  mostrarMotorista,
  aberto,
  onAbrir,
  children,
}: {
  os: OsCampo;
  mostrarMotorista: boolean;
  aberto: boolean;
  onAbrir: () => void;
  children: React.ReactNode;
}) {
  const r = rotulo[os.etapa];
  return (
    <article className="border-border-subtle bg-surface flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-navy-400 text-xs font-semibold">OS Nº {os.numeroOs}</p>
          <p className="text-navy-700 text-lg font-bold dark:text-white">{os.cliente}</p>
        </div>
        <Etiqueta tom={r.tom}>{r.texto}</Etiqueta>
      </div>

      <div className="text-navy-600 dark:text-navy-100 text-sm">
        <p>
          {os.endereco} — {os.cidade}/{os.uf}
        </p>
        <p className="text-navy-400 mt-1 text-xs">
          {os.etapa === 'troca'
            ? `Leva a ${os.numeracao} vazia · recolhe a ${os.numeracaoRecolhida} cheia`
            : `Caçamba ${os.numeracao} · ${os.tipo}`}
          {mostrarMotorista && ` · ${os.motorista ?? 'sem motorista'}`}
        </p>
        {os.observacoes && <p className="mt-1 text-xs">Obs.: {os.observacoes}</p>}
        {os.retiradaPedida && (
          <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Cliente pediu a retirada
          </p>
        )}
      </div>

      {aberto ? (
        children
      ) : (
        <div className="grid grid-cols-2 gap-2 text-sm font-medium">
          {os.etapa !== 'baixa' && (
            <a
              href={linkMapa(os)}
              target="_blank"
              rel="noreferrer"
              className="border-border-subtle text-navy-700 rounded-lg border px-3 py-2.5 text-center dark:text-white"
            >
              Abrir no mapa
            </a>
          )}
          {os.telefone && os.etapa !== 'baixa' && (
            <a
              href={`tel:${os.telefone.replace(/\D/g, '')}`}
              className="border-border-subtle text-navy-700 rounded-lg border px-3 py-2.5 text-center dark:text-white"
            >
              Ligar
            </a>
          )}
          <button
            type="button"
            onClick={onAbrir}
            className="bg-brand-600 hover:bg-brand-700 col-span-2 rounded-lg px-3 py-3 text-center font-semibold text-white"
          >
            {r.texto} — tirar foto
          </button>
        </div>
      )}
    </article>
  );
}

/* ---------------------------------- app ---------------------------------- */

export function AppCampo({
  osServidor,
  geradoEm,
  usuarioId,
  ehGestor,
}: {
  osServidor: OsCampo[];
  geradoEm: string;
  usuarioId: string;
  ehGestor: boolean;
}) {
  const router = useRouter();
  const [fila, setFila] = useState<ItemFila[]>([]);
  const online = useSyncExternalStore(
    assinarConexao,
    () => navigator.onLine,
    () => true,
  );
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Pagina vinda do cache (sem sinal) pode ser mais velha que a lista guardada:
  // vale a mais recente das duas.
  const brutoGuardado = useSyncExternalStore(
    semAssinatura,
    () => lerListaGuardada(usuarioId),
    () => null,
  );
  const dados = useMemo<ListaGuardada>(() => {
    const guardada = interpretar(brutoGuardado);
    return guardada && guardada.geradoEm > geradoEm ? guardada : { geradoEm, lista: osServidor };
  }, [brutoGuardado, geradoEm, osServidor]);

  useEffect(() => {
    if (dados.geradoEm === geradoEm) guardarLista(usuarioId, dados);
  }, [dados, geradoEm, usuarioId]);

  // Timer, volta do sinal e registro novo podem disparar juntos: um envio por vez.
  const enviando = useRef(false);
  const sincronizar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    let resultado: Awaited<ReturnType<typeof enviarFila>> = 'enviado';
    try {
      resultado = await enviarFila(usuarioId);
    } finally {
      enviando.current = false;
      const atual = await listarFila(usuarioId).catch(() => []);
      setFila(atual);
    }
    setSessaoExpirada(resultado === 'sessao_expirada');
    // Com tudo enviado, busca a lista nova do servidor (OS novas, trocas, etc.).
    if (resultado === 'enviado' && navigator.onLine) router.refresh();
  }, [router, usuarioId]);

  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js', { scope: '/' }).catch(() => undefined);

    const ficouOnline = () => void sincronizar();
    window.addEventListener('online', ficouOnline);
    // Primeiro envio fora do corpo do efeito: e assincrono e atualiza estado no fim.
    const t = setTimeout(ficouOnline, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('online', ficouOnline);
    };
  }, [sincronizar]);

  // Enquanto houver fila, tenta de novo de tempos em tempos: o evento "online"
  // nao dispara quando o 4G so estava fraco demais para enviar.
  const pendentes = fila.filter((i) => !i.erro);
  useEffect(() => {
    if (pendentes.length === 0) return;
    const t = setInterval(() => void sincronizar(), 30_000);
    return () => clearInterval(t);
  }, [pendentes.length, sincronizar]);

  const lista = useMemo(() => aplicarFila(dados.lista, fila), [dados.lista, fila]);
  const comErro = fila.filter((i) => i.erro);

  async function aposGuardar() {
    setAberta(null);
    setAviso(
      navigator.onLine
        ? 'Registrado. Enviando…'
        : 'Guardado no celular. Envia sozinho quando voltar o sinal.',
    );
    setFila(await listarFila(usuarioId));
    await sincronizar();
    setAviso(null);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="font-display text-navy-700 text-2xl font-extrabold dark:text-white">
          {ehGestor ? 'OS em campo' : 'Minhas OS'}
        </h1>
        <p className="text-navy-500 dark:text-navy-200 mt-1 text-sm">
          No endereço, toque na OS e tire a foto. Funciona mesmo sem sinal.
        </p>
      </div>

      {!online && (
        <p className="rounded-md border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Sem sinal. Pode continuar registrando: tudo fica guardado no celular.
        </p>
      )}
      {sessaoExpirada && (
        <p className="rounded-md border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          Seu login expirou.{' '}
          <a href="/entrar" className="font-semibold underline">
            Entre de novo
          </a>{' '}
          para enviar o que está guardado — nada foi perdido.
        </p>
      )}
      {pendentes.length > 0 && (
        <p className="rounded-md border-l-4 border-sky-500 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          {pendentes.length} registro(s) aguardando envio (
          {pendentes.map((i) => `OS ${i.numeroOs}`).join(', ')}).
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {aviso}
        </p>
      )}

      {comErro.map((i) => (
        <div
          key={i.chave}
          role="alert"
          className="flex flex-col gap-2 rounded-md border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          <p>
            OS {i.numeroOs} ({rotulo[i.etapa].texto.toLowerCase()}) não foi aceita: {i.erro} Avise o
            escritório.
          </p>
          <button
            type="button"
            onClick={async () => {
              await removerDaFila(i.chave);
              setFila(await listarFila(usuarioId));
            }}
            className="self-start text-xs font-semibold underline"
          >
            Descartar este registro
          </button>
        </div>
      ))}

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
                <CartaoOs
                  key={`${os.id}-${os.etapa}`}
                  os={os}
                  mostrarMotorista={ehGestor}
                  aberto={aberta === os.id}
                  onAbrir={() => setAberta(os.id)}
                >
                  <PainelRegistro
                    os={os}
                    usuarioId={usuarioId}
                    onGuardado={aposGuardar}
                    onFechar={() => setAberta(null)}
                  />
                </CartaoOs>
              ))}
            </section>
          );
        })
      )}

      <p className="text-navy-400 text-center text-xs">
        Lista atualizada em{' '}
        {new Date(dados.geradoEm).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
      </p>
    </div>
  );
}
