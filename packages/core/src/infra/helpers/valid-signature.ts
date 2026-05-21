import crypto from "crypto";

export class ValidSignature {
  static async valid(rawBody: ArrayBuffer, signature: string | null) {
    const bodyBuffer = Buffer.from(rawBody);

    if (!signature) {
      return false;
    }

    const secret = process.env.META_APP_SECRET ?? "";
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(bodyBuffer).digest("hex");

    if (signature !== expected) {
      return false;
    }

    return true;
  }
}
