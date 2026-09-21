/*
 * Service worker do EntuLoc — so para o app do motorista abrir sem sinal.
 *
 * - /campo (a tela das OS): rede primeiro; sem sinal, a ultima copia guardada.
 * - /_next/static: arquivos com hash no nome, nunca mudam — cache primeiro.
 * - Todo o resto (financeiro, API, fotos, login) passa direto, sem cache:
 *   nada de dado de outra tela fica guardado no celular.
 */
const VERSAO = 'entuloc-campo-v1';
const TELA = '/campo';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome !== VERSAO) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (evento) => {
  // Logout: apaga a copia da tela (a fila de registros fica no IndexedDB e nao e tocada).
  if (evento.data === 'limpar') evento.waitUntil(caches.delete(VERSAO));
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.png') {
    evento.respondWith(cachePrimeiro(req));
    return;
  }

  if (req.mode === 'navigate' && url.pathname === TELA) {
    evento.respondWith(redePrimeiro(req));
  }
});

async function cachePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const resposta = await fetch(req);
  if (resposta.ok) cache.put(req, resposta.clone());
  return resposta;
}

async function redePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  try {
    const resposta = await fetch(req);
    // Redirecionou para o login = sessao expirada: nao guarda essa pagina.
    if (resposta.ok && !resposta.redirected) await cache.put(TELA, resposta.clone());
    return resposta;
  } catch {
    const guardada = await cache.match(TELA);
    if (guardada) return guardada;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
        '<body style="font-family:sans-serif;padding:24px"><h1>Sem sinal</h1>' +
        '<p>Abra "Minhas OS" uma vez com internet para usar sem sinal depois.</p></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
    );
  }
}
