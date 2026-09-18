/** Validacao de CPF e CNPJ — digito verificador, nao so tamanho. */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function digitosConferem(base: string, pesos: number[]): boolean {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0);
  const resto = soma % 11;
  const digito = resto < 2 ? 0 : 11 - resto;
  return digito === Number(base[pesos.length]);
}

export function cpfValido(entrada: string): boolean {
  const cpf = apenasDigitos(entrada);
  if (cpf.length !== 11) return false;
  // 111.111.111-11 e afins passam na conta do digito, mas nao existem.
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  return (
    digitosConferem(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    digitosConferem(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  );
}

export function cnpjValido(entrada: string): boolean {
  const cnpj = apenasDigitos(entrada);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  return (
    digitosConferem(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    digitosConferem(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  );
}

export function documentoValido(entrada: string): boolean {
  const d = apenasDigitos(entrada);
  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);
  return false;
}

export function formatarDocumento(entrada: string): string {
  const d = apenasDigitos(entrada);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return entrada;
}
