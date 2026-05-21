/**
 * Utilitário de formatação de telefone para exibição na UI.
 *
 * IMPORTANTE: Este módulo é diferente do PhoneNormalizer do core.
 * - phone-formatter.ts: Formatação para EXIBIÇÃO (10 dígitos = fixo, 11 = celular)
 * - PhoneNormalizer: Normalização para STORAGE/BUSCA (adiciona 9 para matching)
 *
 * A diferença é intencional:
 * - Na UI, queremos mostrar o número como o usuário digitou
 * - No storage, normalizamos para 13 dígitos para encontrar variantes
 */

/**
 * Lista de DDDs (códigos de área) válidos do Brasil.
 *
 * Fonte: ANATEL - Agência Nacional de Telecomunicações
 * Referência: Resolução nº 263/2001 e atualizações
 * Última verificação: Janeiro 2024
 *
 * @see https://www.anatel.gov.br/setorregulado/plano-de-numeracao-brasileiro
 */
export const VALID_BRAZILIAN_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, // São Paulo
  21, 22, 24, // Rio de Janeiro
  27, 28, // Espírito Santo
  31, 32, 33, 34, 35, 37, 38, // Minas Gerais
  41, 42, 43, 44, 45, 46, // Paraná
  47, 48, 49, // Santa Catarina
  51, 53, 54, 55, // Rio Grande do Sul
  61, // Distrito Federal
  62, 64, // Goiás
  63, // Tocantins
  65, 66, // Mato Grosso
  67, // Mato Grosso do Sul
  68, // Acre
  69, // Rondônia
  71, 73, 74, 75, 77, // Bahia
  79, // Sergipe
  81, 87, // Pernambuco
  82, // Alagoas
  83, // Paraíba
  84, // Rio Grande do Norte
  85, 88, // Ceará
  86, 89, // Piauí
  91, 93, 94, // Pará
  92, 97, // Amazonas
  95, // Roraima
  96, // Amapá
  98, 99, // Maranhão
]);

/**
 * Tamanho máximo do campo de telefone formatado.
 * Exemplo: "55 14 9 9133-7211" = 17 caracteres, 20 dá margem para digitação.
 */
export const MAX_PHONE_INPUT_LENGTH = 20;

/**
 * Verifica se uma string de dígitos representa um número de telefone brasileiro válido.
 *
 * Formato brasileiro:
 * - Telefone fixo: 10 dígitos (DDD + 8 dígitos)
 * - Celular: 11 dígitos (DDD + 9 + 8 dígitos)
 *
 * Celulares brasileiros obrigatoriamente têm "9" como terceiro dígito (após o DDD),
 * conforme regulamentação da ANATEL que adicionou o nono dígito em 2012-2016.
 *
 * @param digits - String contendo apenas dígitos do número de telefone
 * @returns true se for um número brasileiro válido, false caso contrário
 *
 * @example
 * isBrazilianNumber("14991337211") // true - celular válido
 * isBrazilianNumber("1433221234")  // true - fixo válido
 * isBrazilianNumber("12125551234") // false - número americano
 */
export function isBrazilianNumber(digits: string): boolean {
  if (digits.length !== 10 && digits.length !== 11) return false;

  const possibleDDD = parseInt(digits.substring(0, 2), 10);
  if (!VALID_BRAZILIAN_DDDS.has(possibleDDD)) return false;

  // Celulares brasileiros (11 dígitos) devem ter "9" como terceiro dígito.
  // Este é o "nono dígito" adicionado pela ANATEL para aumentar a capacidade
  // de numeração de celulares no Brasil.
  if (digits.length === 11 && digits[2] !== "9") return false;

  return true;
}

/**
 * Extrai os dígitos de um número para validação, removendo código do país se presente.
 *
 * Esta função é útil para validar números que podem ter sido digitados com ou sem
 * o código do país (55). Ela normaliza o input para que `isBrazilianNumber` possa
 * validar corretamente.
 *
 * NOTA: Números com DDD 55 (Rio Grande do Sul) são tratados corretamente.
 * Um número de 11 dígitos começando com "55" é interpretado como DDD 55 + celular,
 * não como código do país + número incompleto.
 *
 * @param digits - String contendo apenas dígitos do número
 * @returns Dígitos normalizados para validação (sem código do país)
 *
 * @example
 * extractDigitsForValidation("5514991337211") // "14991337211" (remove 55)
 * extractDigitsForValidation("14991337211")   // "14991337211" (mantém)
 * extractDigitsForValidation("55991234567")   // "55991234567" (DDD 55, mantém)
 */
export function extractDigitsForValidation(digits: string): string {
  // Números com 12+ dígitos começando com 55 têm código do país
  // Números com 11 dígitos começando com 55 são DDD 55 (Rio Grande do Sul)
  if (digits.startsWith("55") && digits.length >= 12) {
    const withoutCountryCode = digits.substring(2);
    if (isBrazilianNumber(withoutCountryCode)) {
      return withoutCountryCode;
    }
  }
  return digits;
}

/**
 * Valida se um número (com ou sem código do país) é brasileiro válido.
 *
 * Esta é a função de validação principal para uso em formulários.
 * Aceita números com ou sem código do país 55.
 *
 * IMPORTANTE: Esta validação aceita APENAS números brasileiros.
 * Números internacionais serão rejeitados. Isso é intencional para
 * garantir compatibilidade com a API do WhatsApp Business no Brasil.
 *
 * @param digits - String contendo apenas dígitos do número
 * @returns true se for um número brasileiro válido
 *
 * @example
 * isValidBrazilianPhone("14991337211")   // true
 * isValidBrazilianPhone("5514991337211") // true
 * isValidBrazilianPhone("12125551234")   // false (número americano)
 */
export function isValidBrazilianPhone(digits: string): boolean {
  const normalized = extractDigitsForValidation(digits);
  return isBrazilianNumber(normalized);
}

/**
 * Formata um número de telefone para exibição, com suporte especial para números brasileiros.
 *
 * Comportamento:
 * - Números brasileiros (10-11 dígitos com DDD válido) recebem código do país 55
 * - Números que já possuem código 55 são normalizados
 * - Números internacionais são preservados sem modificação
 * - Suporta formatação progressiva durante digitação
 *
 * @param value - Número de telefone em qualquer formato (pode conter caracteres não numéricos)
 * @returns Número formatado ou string vazia se input for inválido
 *
 * @example
 * // Celular brasileiro sem código do país
 * formatPhoneNumber("14991337211") // "55 14 9 9133-7211"
 *
 * // Celular brasileiro com código do país
 * formatPhoneNumber("5514991337211") // "55 14 9 9133-7211"
 *
 * // Telefone fixo brasileiro
 * formatPhoneNumber("1433221234") // "55 14 3322-1234"
 *
 * // Número internacional (preservado)
 * formatPhoneNumber("12125551234") // "12125551234"
 *
 * // Com caracteres especiais
 * formatPhoneNumber("(14) 99133-7211") // "55 14 9 9133-7211"
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return "";

  let numbers = value.replace(/\D/g, "");

  if (!numbers) return "";

  // Remove zero inicial apenas se for número brasileiro válido
  if (numbers.startsWith("0") && !numbers.startsWith("00")) {
    const withoutZero = numbers.substring(1);
    if (isBrazilianNumber(withoutZero)) {
      numbers = withoutZero;
    }
  }

  // Remove código 55 existente para normalizar e re-adicionar
  if (numbers.startsWith("55") && numbers.length >= 12) {
    const withoutCountryCode = numbers.substring(2);
    if (isBrazilianNumber(withoutCountryCode)) {
      numbers = withoutCountryCode;
    }
  }

  // Adiciona 55 para números brasileiros locais com DDD válido
  if (isBrazilianNumber(numbers)) {
    numbers = "55" + numbers;
  }

  // Número brasileiro completo com código do país (12 ou 13 dígitos)
  if (numbers.startsWith("55") && (numbers.length === 12 || numbers.length === 13)) {
    const countryCode = numbers.slice(0, 2);
    const ddd = numbers.slice(2, 4);
    const rest = numbers.slice(4);

    if (rest.length === 8) {
      // Telefone fixo: 55 DD XXXX-XXXX
      return `${countryCode} ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    // Celular: 55 DD 9 XXXX-XXXX
    return `${countryCode} ${ddd} ${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5)}`;
  }

  // Formatação progressiva durante digitação
  // Números que começam com 55 (digitando código do país)
  if (numbers.startsWith("55")) {
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;
    if (numbers.length <= 7) return `${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4)}`;

    // 8-11 dígitos: formata com hífen nos últimos 4 dígitos
    const partial = numbers.slice(4);
    if (partial.length <= 4) {
      return `${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${partial}`;
    }
    return `${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${partial.slice(0, partial.length - 4)}-${partial.slice(-4)}`;
  }

  // Números locais em digitação (sem código do país ainda)
  // Aplica formatação progressiva apenas para números de até 9 dígitos
  // Números com 10+ dígitos que não foram identificados como brasileiros são internacionais
  if (numbers.length >= 2 && numbers.length <= 9) {
    const possibleDDD = parseInt(numbers.substring(0, 2), 10);
    if (VALID_BRAZILIAN_DDDS.has(possibleDDD)) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;

      // 7-9 dígitos: formata com hífen nos últimos 4 dígitos
      const partial = numbers.slice(2);
      if (partial.length <= 4) {
        return `${numbers.slice(0, 2)} ${partial}`;
      }
      return `${numbers.slice(0, 2)} ${partial.slice(0, partial.length - 4)}-${partial.slice(-4)}`;
    }
  }

  // Fallback: retorna sem formatação para não corromper números internacionais
  return numbers;
}
