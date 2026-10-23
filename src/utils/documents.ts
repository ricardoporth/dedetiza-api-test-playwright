/**
 * Geradores de CPF e CNPJ VÁLIDOS (com dígitos verificadores corretos).
 * A API valida os dígitos — um número aleatório qualquer seria recusado com 400.
 */

const randomDigits = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 10));

/** Cálculo do dígito verificador usado por CPF e CNPJ (módulo 11). */
function checkDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((total, digit, index) => total + digit * weights[index]!, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function generateCpf(): string {
  const digits = randomDigits(9);
  // CPFs com todos os dígitos iguais (111.111.111-11) passam no cálculo, mas são recusados por regra
  if (new Set(digits).size === 1) return generateCpf();
  digits.push(checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]));
  digits.push(checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]));
  return digits.join('');
}

export function generateCnpj(): string {
  const digits = [...randomDigits(8), 0, 0, 0, 1]; // 0001 = matriz
  digits.push(checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  digits.push(checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return digits.join('');
}

/** Mesmo documento com o último dígito verificador trocado — formato certo, número inválido. */
export function withWrongCheckDigit(document: string): string {
  const last = Number(document.at(-1));
  return `${document.slice(0, -1)}${(last + 1) % 10}`;
}

/** 12345678901 → 123.456.789-01 */
export function formatCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
