import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

export const MessageBuilder = {
  text(prefix?: string): string {
    const timestamp = Date.now();
    const uuid = randomUUID().slice(0, 8);
    return `${prefix || "TEST"}-${timestamp}-${uuid}`;
  },

  uniqueId(): string {
    return randomUUID();
  },

  timestamp(): number {
    return Date.now();
  },

  imageBase64(): string {
    const filePath = path.join(FIXTURES_DIR, "test-image.jpg");
    if (!fs.existsSync(filePath)) {
      return createPlaceholderImage();
    }
    return fs.readFileSync(filePath, "base64");
  },

  audioBase64(): string {
    const filePath = path.join(FIXTURES_DIR, "test-audio.ogg");
    if (!fs.existsSync(filePath)) {
      return createPlaceholderAudio();
    }
    return fs.readFileSync(filePath, "base64");
  },

  documentBase64(): string {
    const filePath = path.join(FIXTURES_DIR, "test-document.pdf");
    if (!fs.existsSync(filePath)) {
      return createPlaceholderDocument();
    }
    return fs.readFileSync(filePath, "base64");
  },

  videoBase64(): string {
    const filePath = path.join(FIXTURES_DIR, "test-video.mp4");
    if (!fs.existsSync(filePath)) {
      throw new Error("test-video.mp4 fixture not found");
    }
    return fs.readFileSync(filePath, "base64");
  },

  formatPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, "");
  },

  formatRemoteJid(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    return `${cleaned}@s.whatsapp.net`;
  },
};

function createPlaceholderImage(): string {
  const width = 100;
  const height = 100;

  const bmpFileHeaderSize = 14;
  const bmpInfoHeaderSize = 40;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = bmpFileHeaderSize + bmpInfoHeaderSize + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);

  buffer.write("BM", 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(bmpFileHeaderSize + bmpInfoHeaderSize, 10);

  buffer.writeUInt32LE(bmpInfoHeaderSize, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  const pixelDataOffset = bmpFileHeaderSize + bmpInfoHeaderSize;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = pixelDataOffset + (y * rowSize) + (x * 3);
      buffer[offset] = 200;
      buffer[offset + 1] = 200;
      buffer[offset + 2] = 200;
    }
  }

  return buffer.toString("base64");
}

function createPlaceholderAudio(): string {
  const buffer = Buffer.from("OggS test audio placeholder", "utf-8");
  return buffer.toString("base64");
}

function createPlaceholderDocument(): string {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
307
%%EOF`;
  return Buffer.from(pdfContent, "utf-8").toString("base64");
}

export type TestMessagePayload = {
  content: string;
  conversationId: string;
  channelId: string;
  workspaceId?: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
    type: "attendant" | "contact";
  };
  type: "text" | "template" | "audio" | "image" | "document" | "video";
  caption?: string;
  filename?: string;
  mimeType?: string;
  correlationId?: string;
};

export function createOutboundPayload(
  overrides: Partial<TestMessagePayload> & {
    content: string;
    conversationId: string;
    channelId: string;
  }
): TestMessagePayload {
  return {
    content: overrides.content,
    conversationId: overrides.conversationId,
    channelId: overrides.channelId,
    workspaceId: overrides.workspaceId,
    createdAt: overrides.createdAt || new Date(),
    sender: overrides.sender || {
      id: "test-sender",
      name: "Test Sender",
      type: "attendant",
    },
    type: overrides.type || "text",
    caption: overrides.caption,
    filename: overrides.filename,
    mimeType: overrides.mimeType,
    correlationId: overrides.correlationId || MessageBuilder.uniqueId(),
  };
}
