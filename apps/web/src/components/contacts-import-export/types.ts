export type TabValue = "export" | "import";

export type ImportProgress = {
  isImporting: boolean;
  currentBatch: number;
  totalBatches: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; name: string; error: string }>;
};

export type ParsedContact = {
  name: string;
  phone: string;
  normalizedPhone: string | null;
  phoneStatus: "valid" | "invalid" | "empty";
  email?: string;
  tags?: string;
  data_nascimento?: string;
  cep?: string;
  endereco?: string;
  [key: string]: string | null | undefined;
};

export type ProcessedData = {
  valid: ParsedContact[];
  invalid: ParsedContact[];
  emptyPhone: ParsedContact[];
  duplicateCount: number;
  total: number;
};
