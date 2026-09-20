import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
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

    // Convert uploaded file into a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from PDF
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const extractedText = result.text;
    const pageCount = result.total;

    await parser.destroy();

    // Create uploads folder if it does not exist
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    await mkdir(uploadDirectory, { recursive: true });

    // Create documents data folder if it does not exist
    const documentsDirectory = path.join(
      process.cwd(),
      "data",
      "documents"
    );

    await mkdir(documentsDirectory, { recursive: true });

    // Create unique ID for the document
    const documentId = randomUUID();

    // Make the PDF filename safe
    const safeFileName = `${documentId}-${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;

    // Save PDF
    const filePath = path.join(
      uploadDirectory,
      safeFileName
    );

    await writeFile(filePath, buffer);

    // Save extracted text separately
    const textFilePath = path.join(
      documentsDirectory,
      `${documentId}.txt`
    );

    await writeFile(textFilePath, extractedText, "utf8");

    return NextResponse.json({
      message: "PDF uploaded and text extracted successfully.",
      documentId,
      fileName: file.name,
      fileUrl: `/uploads/${safeFileName}`,
      pageCount,
      extractedText,
      textPreview: extractedText.slice(0, 1500),
    });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while processing the PDF.",
      },
      { status: 500 }
    );
  }
}