import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { JWTTokenDriver } from "@omnichannel/core/infra/drivers/token-driver";
import { UsersDatabaseRepository } from "@omnichannel/core/infra/repositories/users-repository";
import { COOKIE_TOKEN_NAME } from "@/app/constants";

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

const ALLOWED_MIME_TYPES = {
  audio: ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/webm"],
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
  ],
};

function isAllowedMimeType(mimeType: string): boolean {
  return Object.values(ALLOWED_MIME_TYPES)
    .flat()
    .includes(mimeType);
}

const usersRepository = UsersDatabaseRepository.instance();

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_TOKEN_NAME);

    if (!token?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = JWTTokenDriver.instance().decode(token.value);
    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = await usersRepository.retrieve(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 16MB" },
        { status: 400 }
      );
    }

    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      filename: file.name,
      mimeType: file.type,
    });
  } catch (error) {
    console.error("Flow media upload error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}
