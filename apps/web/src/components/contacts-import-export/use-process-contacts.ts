import { useMemo } from "react";
import type { ParsedContact, ProcessedData } from "./types";

export function useProcessContacts(rawImportData: ParsedContact[]): ProcessedData {
  return useMemo(() => {
    const validContacts: ParsedContact[] = [];
    const invalidContacts: ParsedContact[] = [];
    const emptyPhoneContacts: ParsedContact[] = [];
    const duplicatePhones = new Set<string>();
    const seenPhones = new Set<string>();

    for (const contact of rawImportData) {
      if (contact.phoneStatus === "empty") {
        emptyPhoneContacts.push(contact);
        continue;
      }

      if (contact.phoneStatus === "invalid") {
        invalidContacts.push(contact);
        continue;
      }

      if (contact.normalizedPhone && seenPhones.has(contact.normalizedPhone)) {
        duplicatePhones.add(contact.normalizedPhone);
        continue;
      }

      if (contact.normalizedPhone) {
        seenPhones.add(contact.normalizedPhone);
      }
      validContacts.push(contact);
    }

    return {
      valid: validContacts,
      invalid: invalidContacts,
      emptyPhone: emptyPhoneContacts,
      duplicateCount: duplicatePhones.size,
      total: rawImportData.length,
    };
  }, [rawImportData]);
}
