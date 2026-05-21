import { useState, useCallback } from "react";

export type SearchType =
  | "phone"
  | "instagram"
  | "client-name"
  | "attendant-name"
  | "all";

export interface SmartSearchResult {
  type: SearchType;
  value: string;
  needsDisambiguation: boolean;
}

export function useSmartSearch() {
  const [searchResult, setSearchResult] = useState<SmartSearchResult>({
    type: "all",
    value: "",
    needsDisambiguation: false,
  });

  const detectType = useCallback((input: string): SmartSearchResult => {
    const trimmed = input.trim();

    if (!trimmed) {
      return {
        type: "all",
        value: "",
        needsDisambiguation: false,
      };
    }

    if (/^\d{10,13}$/.test(trimmed)) {
      return {
        type: "phone",
        value: trimmed,
        needsDisambiguation: false,
      };
    }

    if (trimmed.startsWith("@")) {
      return {
        type: "instagram",
        value: trimmed.substring(1),
        needsDisambiguation: false,
      };
    }

    if (trimmed.length >= 2) {
      return {
        type: "all",
        value: trimmed,
        needsDisambiguation: true,
      };
    }

    return {
      type: "all",
      value: trimmed,
      needsDisambiguation: false,
    };
  }, []);

  const setSearch = useCallback(
    (input: string, disambiguatedType?: "client-name" | "attendant-name") => {
      const result = detectType(input);

      if (result.needsDisambiguation && disambiguatedType) {
        setSearchResult({
          ...result,
          type: disambiguatedType,
          needsDisambiguation: false,
        });
      } else {
        setSearchResult(result);
      }
    },
    [detectType]
  );

  return {
    searchResult,
    setSearch,
    detectType,
  };
}

export function getSearchTypeLabel(type: SearchType): string {
  const labels: Record<SearchType, string> = {
    phone: "Telefone",
    instagram: "Instagram",
    "client-name": "Nome do Cliente",
    "attendant-name": "Nome do Atendente",
    all: "Busca Geral",
  };

  return labels[type];
}

export function getSearchTypeIcon(type: SearchType): string {
  const icons: Record<SearchType, string> = {
    phone: "tabler-phone",
    instagram: "tabler-brand-instagram",
    "client-name": "tabler-user",
    "attendant-name": "tabler-user-check",
    all: "tabler-search",
  };

  return icons[type];
}
