import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

// promisify nao captura a sobrecarga com options; o tipo e declarado aqui.
const scryptAsync = promisify(scrypt) as (
  senha: string | Buffer,
  salt: string | Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
) => Promise<Buffer>;

/**
 * Hash de senha com scrypt do proprio Node.
 *
 * scrypt e memory-hard (resiste a ataque com GPU) e vem no runtime, sem
 * dependencia nativa para instalar nem pacote de terceiros na cadeia de
 * suprimentos. Parametros seguem a recomendacao do OWASP: N=2^17, r=8, p=1.
 */
const N = 2 ** 17;
const R = 8;
const P = 1;
const TAMANHO_CHAVE = 64;
const TAMANHO_SALT = 16;

// scrypt precisa de memoria ~= 128 * N * r; o default do Node (32 MB) estoura.
const MAXMEM = 256 * N * R;

export async function gerarHashSenha(senha: string): Promise<string> {
  if (senha.length < 8) {
    throw new Error('A senha precisa ter ao menos 8 caracteres');
  }
  const salt = randomBytes(TAMANHO_SALT);
  const derivada = await scryptAsync(senha.normalize('NFKC'), salt, TAMANHO_CHAVE, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return `${salt.toString('hex')}:${derivada.toString('hex')}`;
}

export async function conferirSenha(senha: string, armazenado: string): Promise<boolean> {
  const [saltHex, hashHex] = armazenado.split(':');
  if (!saltHex || !hashHex) return false;

  let esperado: Buffer;
  try {
    esperado = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (esperado.length !== TAMANHO_CHAVE) return false;

  const derivada = (await scryptAsync(
    senha.normalize('NFKC'),
    Buffer.from(saltHex, 'hex'),
    TAMANHO_CHAVE,
    {
      N,
      r: R,
      p: P,
      maxmem: MAXMEM,
    },
  )) as Buffer;

  // Comparacao em tempo constante: `===` vaza o tamanho do prefixo correto.
  return timingSafeEqual(derivada, esperado);
}

/**
 * Senha provisoria sorteada: mostrada UMA vez para o gestor repassar e trocada
 * pelo usuario no primeiro acesso. Sem `-`/`_` para ditar por telefone sem erro.
 */
export function senhaProvisoria(): string {
  return randomBytes(12).toString('base64url').replace(/[-_]/g, 'x').slice(0, 14);
}
