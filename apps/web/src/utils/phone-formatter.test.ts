import { describe, it, expect } from "vitest";
import {
  formatPhoneNumber,
  isBrazilianNumber,
  isValidBrazilianPhone,
  extractDigitsForValidation,
  VALID_BRAZILIAN_DDDS,
} from "./phone-formatter";

describe("VALID_BRAZILIAN_DDDS", () => {
  it("should contain all valid Brazilian DDDs", () => {
    const expectedDDDs = [
      11, 12, 13, 14, 15, 16, 17, 18, 19,
      21, 22, 24, 27, 28,
      31, 32, 33, 34, 35, 37, 38,
      41, 42, 43, 44, 45, 46,
      47, 48, 49,
      51, 53, 54, 55,
      61, 62, 63, 64, 65, 66, 67, 68, 69,
      71, 73, 74, 75, 77, 79,
      81, 82, 83, 84, 85, 86, 87, 88, 89,
      91, 92, 93, 94, 95, 96, 97, 98, 99,
    ];
    expectedDDDs.forEach((ddd) => {
      expect(VALID_BRAZILIAN_DDDS.has(ddd)).toBe(true);
    });
  });

  it("should not contain invalid DDDs", () => {
    const invalidDDDs = [10, 20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56, 57, 58, 59, 60, 70, 72, 76, 78, 80, 90];
    invalidDDDs.forEach((ddd) => {
      expect(VALID_BRAZILIAN_DDDS.has(ddd)).toBe(false);
    });
  });
});

describe("isBrazilianNumber", () => {
  describe("valid Brazilian numbers", () => {
    it("should return true for valid mobile numbers (11 digits)", () => {
      expect(isBrazilianNumber("14991337211")).toBe(true);
      expect(isBrazilianNumber("11999887766")).toBe(true);
      expect(isBrazilianNumber("21987654321")).toBe(true);
    });

    it("should return true for valid landline numbers (10 digits)", () => {
      expect(isBrazilianNumber("1433221234")).toBe(true);
      expect(isBrazilianNumber("1132165498")).toBe(true);
      expect(isBrazilianNumber("2133334444")).toBe(true);
    });

    it("should return true for DDD 55 (Rio Grande do Sul)", () => {
      expect(isBrazilianNumber("5533334444")).toBe(true);
      expect(isBrazilianNumber("55991234567")).toBe(true);
    });
  });

  describe("invalid numbers", () => {
    it("should return false for numbers with invalid length", () => {
      expect(isBrazilianNumber("123456789")).toBe(false);
      expect(isBrazilianNumber("123456789012")).toBe(false);
    });

    it("should return false for numbers with invalid DDD", () => {
      expect(isBrazilianNumber("1099887766")).toBe(false);
      expect(isBrazilianNumber("2099887766")).toBe(false);
      expect(isBrazilianNumber("3099887766")).toBe(false);
    });

    it("should return false for 11-digit numbers without 9 as third digit", () => {
      expect(isBrazilianNumber("14891337211")).toBe(false);
      expect(isBrazilianNumber("11899887766")).toBe(false);
    });

    it("should return false for US-like numbers", () => {
      expect(isBrazilianNumber("12125551234")).toBe(false);
      expect(isBrazilianNumber("13015551234")).toBe(false);
    });
  });
});

describe("extractDigitsForValidation", () => {
  it("should remove country code from 12+ digit numbers", () => {
    expect(extractDigitsForValidation("5514991337211")).toBe("14991337211");
    expect(extractDigitsForValidation("551433221234")).toBe("1433221234");
  });

  it("should preserve 11-digit numbers starting with 55 (DDD 55)", () => {
    expect(extractDigitsForValidation("55991234567")).toBe("55991234567");
  });

  it("should preserve numbers without country code", () => {
    expect(extractDigitsForValidation("14991337211")).toBe("14991337211");
    expect(extractDigitsForValidation("1433221234")).toBe("1433221234");
  });

  it("should preserve international numbers", () => {
    expect(extractDigitsForValidation("12125551234")).toBe("12125551234");
  });
});

describe("isValidBrazilianPhone", () => {
  describe("valid numbers", () => {
    it("should accept Brazilian numbers without country code", () => {
      expect(isValidBrazilianPhone("14991337211")).toBe(true);
      expect(isValidBrazilianPhone("1433221234")).toBe(true);
    });

    it("should accept Brazilian numbers with country code", () => {
      expect(isValidBrazilianPhone("5514991337211")).toBe(true);
      expect(isValidBrazilianPhone("551433221234")).toBe(true);
    });

    it("should accept DDD 55 numbers (Rio Grande do Sul)", () => {
      expect(isValidBrazilianPhone("55991234567")).toBe(true);
      expect(isValidBrazilianPhone("5533334444")).toBe(true);
    });
  });

  describe("invalid numbers", () => {
    it("should reject international numbers", () => {
      expect(isValidBrazilianPhone("12125551234")).toBe(false);
      expect(isValidBrazilianPhone("447911123456")).toBe(false);
    });

    it("should reject numbers with invalid DDD", () => {
      expect(isValidBrazilianPhone("1099887766")).toBe(false);
    });

    it("should reject numbers with invalid length", () => {
      expect(isValidBrazilianPhone("123456789")).toBe(false);
      expect(isValidBrazilianPhone("123456789012")).toBe(false);
    });
  });
});

describe("formatPhoneNumber", () => {
  describe("empty and invalid inputs", () => {
    it("should return empty string for empty input", () => {
      expect(formatPhoneNumber("")).toBe("");
      expect(formatPhoneNumber("   ")).toBe("");
    });
  });

  describe("Brazilian mobile numbers", () => {
    it("should format local mobile number (without country code)", () => {
      expect(formatPhoneNumber("14991337211")).toBe("55 14 9 9133-7211");
    });

    it("should format mobile number with country code", () => {
      expect(formatPhoneNumber("5514991337211")).toBe("55 14 9 9133-7211");
    });

    it("should format mobile with leading zero", () => {
      expect(formatPhoneNumber("014991337211")).toBe("55 14 9 9133-7211");
    });

    it("should format mobile with special characters", () => {
      expect(formatPhoneNumber("(14) 99133-7211")).toBe("55 14 9 9133-7211");
      expect(formatPhoneNumber("+55 14 99133-7211")).toBe("55 14 9 9133-7211");
      expect(formatPhoneNumber("55-14-99133-7211")).toBe("55 14 9 9133-7211");
    });
  });

  describe("Brazilian landline numbers", () => {
    it("should format local landline number (without country code)", () => {
      expect(formatPhoneNumber("1433221234")).toBe("55 14 3322-1234");
    });

    it("should format landline number with country code", () => {
      expect(formatPhoneNumber("551433221234")).toBe("55 14 3322-1234");
    });

    it("should format landline with leading zero", () => {
      expect(formatPhoneNumber("01433221234")).toBe("55 14 3322-1234");
    });
  });

  describe("DDD 55 (Rio Grande do Sul) edge case", () => {
    it("should correctly format landline with DDD 55", () => {
      expect(formatPhoneNumber("5533334444")).toBe("55 55 3333-4444");
    });

    it("should correctly format mobile with DDD 55", () => {
      expect(formatPhoneNumber("55991234567")).toBe("55 55 9 9123-4567");
    });

    it("should format DDD 55 with country code already present", () => {
      expect(formatPhoneNumber("555533334444")).toBe("55 55 3333-4444");
      expect(formatPhoneNumber("5555991234567")).toBe("55 55 9 9123-4567");
    });
  });

  describe("international numbers (should not be modified)", () => {
    it("should not modify US numbers", () => {
      expect(formatPhoneNumber("12125551234")).toBe("12125551234");
      expect(formatPhoneNumber("13015551234")).toBe("13015551234");
    });

    it("should not modify other international numbers", () => {
      expect(formatPhoneNumber("447911123456")).toBe("447911123456");
      expect(formatPhoneNumber("33123456789")).toBe("33123456789");
    });
  });

  describe("progressive formatting during typing", () => {
    it("should format partial numbers starting with valid DDD (3-6 digits)", () => {
      expect(formatPhoneNumber("14")).toBe("14");
      expect(formatPhoneNumber("149")).toBe("14 9");
      expect(formatPhoneNumber("1499")).toBe("14 99");
      expect(formatPhoneNumber("14991")).toBe("14 991");
      expect(formatPhoneNumber("149913")).toBe("14 9913");
    });

    it("should format partial numbers starting with valid DDD (7-9 digits)", () => {
      expect(formatPhoneNumber("1499133")).toBe("14 9-9133");
      expect(formatPhoneNumber("14991337")).toBe("14 99-1337");
      expect(formatPhoneNumber("149913372")).toBe("14 991-3372");
    });

    it("should recognize 10-digit numbers as complete Brazilian landlines", () => {
      // 10 dígitos com DDD válido = telefone fixo brasileiro completo
      expect(formatPhoneNumber("1499133721")).toBe("55 14 9913-3721");
    });

    it("should format partial numbers starting with 55 (3-7 digits)", () => {
      expect(formatPhoneNumber("55")).toBe("55");
      expect(formatPhoneNumber("5514")).toBe("55 14");
      expect(formatPhoneNumber("55149")).toBe("55 14 9");
      expect(formatPhoneNumber("551499")).toBe("55 14 99");
      expect(formatPhoneNumber("5514991")).toBe("55 14 991");
    });

    it("should format partial numbers starting with 55 (8-9 digits)", () => {
      expect(formatPhoneNumber("55149913")).toBe("55 14 9913");
      expect(formatPhoneNumber("551499133")).toBe("55 14 9-9133");
    });

    it("should recognize 10-digit numbers starting with 55 as DDD 55 landlines", () => {
      // 5514991337 = DDD 55 (RS) + 14991337 = telefone fixo brasileiro
      expect(formatPhoneNumber("5514991337")).toBe("55 55 1499-1337");
      // 5533334444 = DDD 55 (RS) + 33334444 = telefone fixo brasileiro
      expect(formatPhoneNumber("5533334444")).toBe("55 55 3333-4444");
    });

    it("should format 11-digit partial numbers starting with 55", () => {
      expect(formatPhoneNumber("55149913372")).toBe("55 14 991-3372");
    });
  });

  describe("numbers starting with 00 (international prefix)", () => {
    it("should not modify numbers starting with 00", () => {
      expect(formatPhoneNumber("0014991337211")).toBe("0014991337211");
      expect(formatPhoneNumber("005514991337211")).toBe("005514991337211");
    });
  });

  describe("idempotency", () => {
    it("should produce same result when applied multiple times", () => {
      const input = "14991337211";
      const formatted = formatPhoneNumber(input);
      const doubleFormatted = formatPhoneNumber(formatted);
      expect(doubleFormatted).toBe(formatted);
    });
  });
});
