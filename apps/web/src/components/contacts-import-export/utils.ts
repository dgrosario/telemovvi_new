// Função para normalizar telefone brasileiro
export function normalizePhoneBR(phone: string): { 
  normalized: string | null; 
  status: "valid" | "invalid" | "empty" 
} {
  if (!phone || !phone.trim()) {
    return { normalized: null, status: "empty" };
  }

  let digits = phone.replace(/\D/g, "");

  if (!digits) {
    return { normalized: null, status: "empty" };
  }

  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  if (!digits.startsWith("55")) {
    digits = "55" + digits;
  }

  const countryCode = digits.substring(0, 2);
  const rest = digits.substring(2);

  if (rest.length < 10 || rest.length > 11) {
    return { normalized: null, status: "invalid" };
  }

  const ddd = rest.substring(0, 2);
  let number = rest.substring(2);

  const dddNum = parseInt(ddd, 10);
  if (dddNum < 11 || dddNum > 99) {
    return { normalized: null, status: "invalid" };
  }

  if (number.length === 8) {
    number = "9" + number;
  }

  if (number.length !== 9 || !number.startsWith("9")) {
    return { normalized: null, status: "invalid" };
  }

  const normalized = countryCode + ddd + number;
  return { normalized, status: "valid" };
}

export function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}
