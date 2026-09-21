'use client';

import { useEffect } from 'react';

/**
 * Na tela de login ninguem esta logado: apaga a copia offline da lista de OS
 * (pode ser celular compartilhado). A FILA de registros nao e apagada — ela
 * tem fotos ainda nao enviadas e so sai quando o dono logar e enviar.
 */
export function LimparCopiaOffline() {
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage('limpar');
    try {
      for (const chave of Object.keys(localStorage)) {
        if (chave.startsWith('entuloc:campo:')) localStorage.removeItem(chave);
      }
    } catch {
      // armazenamento bloqueado: nada a limpar
    }
  }, []);
  return null;
}
