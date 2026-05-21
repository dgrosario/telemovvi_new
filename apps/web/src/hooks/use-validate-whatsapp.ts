"use client";

import { useState, useCallback } from "react";
import { useServerAction } from "zsa-react";
import { validateWhatsAppNumbers, ValidationResult } from "@/app/actions/validation";

interface UseValidateWhatsAppReturn {
  validate: (numbers: string[], instanceName?: string) => Promise<ValidationResult[]>;
  validateSingle: (number: string, instanceName?: string) => Promise<boolean>;
  isValidating: boolean;
  error: string | null;
}

export function useValidateWhatsApp(): UseValidateWhatsAppReturn {
  const [error, setError] = useState<string | null>(null);
  const { execute, isPending } = useServerAction(validateWhatsAppNumbers);

  const validate = useCallback(
    async (numbers: string[], instanceName?: string): Promise<ValidationResult[]> => {
      setError(null);

      const cleanedNumbers = numbers
        .map((n) => n.replace(/\D/g, ""))
        .filter((n) => n.length >= 10);

      if (cleanedNumbers.length === 0) {
        return [];
      }

      const [data, err] = await execute({ numbers: cleanedNumbers, instanceName });

      if (err) {
        const errorMessage = err.message || "Erro ao validar números";
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      return data ?? [];
    },
    [execute]
  );

  const validateSingle = useCallback(
    async (number: string, instanceName?: string): Promise<boolean> => {
      const results = await validate([number], instanceName);
      return results.length > 0 && results[0].exists;
    },
    [validate]
  );

  return { validate, validateSingle, isValidating: isPending, error };
}
