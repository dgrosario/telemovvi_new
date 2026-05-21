import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, getErrorMessage } from "../error-messages";

describe("getErrorMessage", () => {
  it("returns mapped conflict message for plain JSON payload", () => {
    const result = getErrorMessage(
      new Error(
        JSON.stringify({
          code: "CONFLICT",
          message: "Conversa já atribuída",
        })
      ),
      "Fallback"
    );

    expect(result).toEqual({
      message: ERROR_MESSAGES.CONFLICT,
      isConflict: true,
    });
  });

  it("parses wrapped Error payload", () => {
    const result = getErrorMessage(
      new Error(
        `Error: ${JSON.stringify({
          code: "CONFLICT",
          message: "Conversa já atribuída",
        })}`
      ),
      "Fallback"
    );

    expect(result).toEqual({
      message: ERROR_MESSAGES.CONFLICT,
      isConflict: true,
    });
  });

  it("parses double-serialized payload", () => {
    const payload = JSON.stringify(
      JSON.stringify({
        code: "CONFLICT",
        message: "Conversa já atribuída",
      })
    );

    const result = getErrorMessage(new Error(payload), "Fallback");

    expect(result).toEqual({
      message: ERROR_MESSAGES.CONFLICT,
      isConflict: true,
    });
  });

  it("detects conflict from non-JSON message fallback", () => {
    const result = getErrorMessage(
      new Error("Request failed with CONFLICT"),
      "Fallback"
    );

    expect(result).toEqual({
      message: ERROR_MESSAGES.CONFLICT,
      isConflict: true,
    });
  });

  it("returns default for unknown payload", () => {
    const result = getErrorMessage(new Error("Random failure"), "Fallback");

    expect(result).toEqual({
      message: "Fallback",
      isConflict: false,
    });
  });
});
