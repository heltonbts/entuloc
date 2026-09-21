/**
 * Fila de registros de campo guardada no celular (IndexedDB).
 *
 * Todo registro passa por aqui, com ou sem sinal: grava primeiro, envia
 * depois. Assim ha um caminho so, e fechar o app ou perder o sinal no meio
 * do envio nao perde a foto — ela fica ate o servidor confirmar.
 */

export type ItemFila = {
  chave: string;
  /** Dono do registro: outro login no mesmo celular nao envia a fila alheia. */
  usuarioId: string;
  id: string;
  numeroOs: number;
  etapa: 'entrega' | 'troca' | 'retirada' | 'baixa';
  destino?: 'deposito' | 'venda';
  latitude?: number;
  longitude?: number;
  capturadoEm: string;
  foto: Blob;
  fotoRetirada?: Blob;
  /** Recusado pelo servidor (nao e falta de sinal): o motorista decide o que fazer. */
  erro?: string;
};

const BANCO = 'entuloc-campo';
const LOJA = 'fila';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'chave' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

async function transacao<T>(
  modo: IDBTransactionMode,
  fazer: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const req = fazer(db.transaction(LOJA, modo).objectStore(LOJA));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(req.error);
    });
  } finally {
    db.close();
  }
}

export async function listarFila(usuarioId: string): Promise<ItemFila[]> {
  const todos = await transacao<ItemFila[]>('readonly', (l) => l.getAll());
  // Ordem de gravacao: a retirada tem que chegar antes da baixa da mesma OS.
  return todos
    .filter((i) => i.usuarioId === usuarioId)
    .sort((a, b) => (a.chave < b.chave ? -1 : 1));
}

export async function guardarNaFila(item: Omit<ItemFila, 'chave'>): Promise<void> {
  const chave = `${Date.now().toString().padStart(15, '0')}-${crypto.randomUUID()}`;
  await transacao('readwrite', (l) => l.put({ ...item, chave }));
}

export async function removerDaFila(chave: string): Promise<void> {
  await transacao('readwrite', (l) => l.delete(chave));
}

async function marcarErro(item: ItemFila, erro: string): Promise<void> {
  await transacao('readwrite', (l) => l.put({ ...item, erro }));
}

export type ResultadoEnvio = 'enviado' | 'sem_sinal' | 'sessao_expirada';

/**
 * Envia a fila na ordem. Para no primeiro sem-sinal (o resto tambem falharia)
 * e na sessao expirada (precisa logar de novo; a fila fica guardada).
 */
export async function enviarFila(usuarioId: string): Promise<ResultadoEnvio> {
  for (const item of await listarFila(usuarioId)) {
    if (item.erro) continue;

    const dados = new FormData();
    dados.set('id', item.id);
    dados.set('etapa', item.etapa);
    dados.set('capturadoEm', item.capturadoEm);
    dados.set('foto', item.foto, 'foto.jpg');
    if (item.fotoRetirada) dados.set('fotoRetirada', item.fotoRetirada, 'recolhida.jpg');
    if (item.destino) dados.set('destino', item.destino);
    if (item.latitude !== undefined) dados.set('latitude', String(item.latitude));
    if (item.longitude !== undefined) dados.set('longitude', String(item.longitude));

    let resposta: Response;
    try {
      resposta = await fetch('/api/campo/registro', { method: 'POST', body: dados });
    } catch {
      return 'sem_sinal';
    }

    if (resposta.status === 401) return 'sessao_expirada';
    // 409 = ja estava registrado (reenvio de algo que chegou): missao cumprida.
    if (resposta.ok || resposta.status === 409) {
      await removerDaFila(item.chave);
    } else if (resposta.status >= 500) {
      return 'sem_sinal'; // falha passageira do servidor: tenta de novo depois
    } else {
      const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      await marcarErro(item, corpo?.erro ?? 'O servidor recusou o registro.');
    }
  }
  return 'enviado';
}
