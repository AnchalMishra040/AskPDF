import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

PDFParse.setWorker(getData());

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file selected" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 20 MB" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from PDF
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const extractedText = result.text;
    const pageCount = result.total;

    await parser.destroy();

    // Save PDF file
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    const safeFileName = `${randomUUID()}-${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;

    const filePath = path.join(uploadDirectory, safeFileName);

    await writeFile(filePath, buffer);

   return NextResponse.json({
  message: "PDF uploaded and text extracted successfully.",
  fileName: file.name,
  fileUrl: `/uploads/${safeFileName}`,
  pageCount,
  extractedText,
  textPreview: extractedText.slice(0, 1500),
   });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "Something went wrong while processing the PDF." },
      { status: 500 }
    );
  }
}