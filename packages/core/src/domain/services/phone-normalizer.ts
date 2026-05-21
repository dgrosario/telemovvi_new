export class PhoneNormalizer {
  static isValidPhoneNumber(phone: string): boolean {
    if (!phone) return false;

    const digits = phone.replace(/\D/g, "");

    // Valid phone numbers: 7-13 digits
    // - Brazilian: 10-13 digits (with/without country code, with/without 9)
    // - International: 7-13 digits
    // Numbers with 14+ digits are group JIDs or LIDs, not phone numbers
    if (digits.length < 7 || digits.length > 13) {
      return false;
    }

    return true;
  }

  static isLinkedId(remoteJid: string): boolean {
    if (!remoteJid) return false;

    // Explicit @lid suffix indicates a WhatsApp Linked ID
    if (remoteJid.endsWith("@lid")) {
      return true;
    }

    // Extract digits from the JID
    const raw = remoteJid
      .replace("@s.whatsapp.net", "")
      .replace("@g.us", "")
      .replace("@lid", "");
    const digits = raw.replace(/\D/g, "");

    // LIDs typically have 14-15 digits and don't follow phone number patterns
    // They don't start with country codes like 55 (Brazil)
    if (digits.length >= 14 && !digits.startsWith("55")) {
      return true;
    }

    return false;
  }

  static normalize(phone: string): string {
    if (!phone) return phone;

    const digits = phone.replace(/\D/g, "");

    // Brazilian number without country code (10 or 11 digits)
    if (digits.length === 10 || digits.length === 11) {
      const withCountry = "55" + digits;
      // Normalize to 13 digits (with the 9)
      if (withCountry.length === 12) {
        const country = withCountry.slice(0, 2);
        const ddd = withCountry.slice(2, 4);
        const number = withCountry.slice(4);
        return `${country}${ddd}9${number}`;
      }
      return withCountry;
    }

    // Brazilian number with country code
    if (digits.startsWith("55") && digits.length === 12) {
      const country = digits.slice(0, 2);
      const ddd = digits.slice(2, 4);
      const number = digits.slice(4);
      return `${country}${ddd}9${number}`;
    }

    return digits;
  }

  static getVariants(phone: string): string[] {
    if (!phone) return [phone];

    const digits = phone.replace(/\D/g, "");
    const variants = new Set<string>();

    // Add the original number
    variants.add(digits);

    // Brazilian number without country code (10 or 11 digits)
    if (digits.length === 10 || digits.length === 11) {
      const withCountry = "55" + digits;
      variants.add(withCountry);

      if (digits.length === 10) {
        // Add version with 9
        const with9 = "55" + digits.slice(0, 2) + "9" + digits.slice(2);
        variants.add(with9);
      }
      if (digits.length === 11) {
        // Add version without 9
        const without9 = "55" + digits.slice(0, 2) + digits.slice(3);
        variants.add(without9);
      }
    }

    // Brazilian number with country code
    if (digits.startsWith("55")) {
      if (digits.length === 13) {
        // Has 9, add version without
        const without9 = digits.slice(0, 4) + digits.slice(5);
        variants.add(without9);
        // Also add without country code
        variants.add(digits.slice(2)); // 11 digits
        variants.add(digits.slice(2, 4) + digits.slice(5)); // 10 digits
      }
      if (digits.length === 12) {
        // Doesn't have 9, add version with
        const with9 = digits.slice(0, 4) + "9" + digits.slice(4);
        variants.add(with9);
        // Also add without country code
        variants.add(digits.slice(2)); // 10 digits
        variants.add(digits.slice(2, 4) + "9" + digits.slice(4)); // 11 digits
      }
    }

    return Array.from(variants);
  }
}
