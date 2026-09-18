import { describe, expect, it } from 'vitest';

import { cnpjValido, cpfValido, documentoValido, formatarDocumento } from './documento';

describe('cpfValido', () => {
  it('aceita CPF com digito correto', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('recusa digito verificador errado', () => {
    expect(cpfValido('529.982.247-26')).toBe(false);
  });

  it('recusa sequencia repetida que passaria na conta', () => {
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('00000000000')).toBe(false);
  });

  it('recusa tamanho errado', () => {
    expect(cpfValido('1234')).toBe(false);
  });
});

describe('cnpjValido', () => {
  it('aceita CNPJ valido', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  });

  it('recusa digito errado', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
  });

  it('recusa repetido', () => {
    expect(cnpjValido('11111111111111')).toBe(false);
  });
});

describe('documentoValido', () => {
  it('escolhe a regra pelo tamanho', () => {
    expect(documentoValido('52998224725')).toBe(true);
    expect(documentoValido('11222333000181')).toBe(true);
    expect(documentoValido('123')).toBe(false);
  });
});

describe('formatarDocumento', () => {
  it('formata CPF e CNPJ', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
  });
});
