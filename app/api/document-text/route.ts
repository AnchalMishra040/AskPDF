import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Allow only UUID-style document IDs
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    const textFilePath = path.join(
      process.cwd(),
      "data",
      "documents",
      `${documentId}.txt`
    );

    const extractedText = await readFile(
      textFilePath,
      "utf8"
    );

    return NextResponse.json({
      documentId,
      extractedText,
    });
  } catch (error) {
    console.error("Document text error:", error);

    return NextResponse.json(
      { error: "Unable to load document text." },
      { status: 500 }
    );
  }
}