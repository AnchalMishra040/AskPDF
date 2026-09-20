import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

PDFParse.setWorker(getData());

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

    const documentsDirectory = path.join(
      process.cwd(),
      "data",
      "documents"
    );

    const textFilePath = path.join(
      documentsDirectory,
      `${documentId}.txt`
    );

    // First try to load already saved text
    try {
      const extractedText = await readFile(
        textFilePath,
        "utf8"
      );

      return NextResponse.json({
        documentId,
        extractedText,
      });
    } catch {
      // Text file does not exist.
      // We will extract the text from the existing PDF.
    }

    // Find the PDF using its document ID
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    const { readdir } = await import("fs/promises");

    const files = await readdir(uploadDirectory);

    const pdfFileName = files.find(
      (file) =>
        file.startsWith(`${documentId}-`) &&
        file.toLowerCase().endsWith(".pdf")
    );

    if (!pdfFileName) {
      return NextResponse.json(
        { error: "PDF file not found." },
        { status: 404 }
      );
    }

    const pdfFilePath = path.join(
      uploadDirectory,
      pdfFileName
    );

    // Read the existing PDF
    const pdfBuffer = await readFile(pdfFilePath);

    // Extract text from the PDF
    const parser = new PDFParse({
      data: pdfBuffer,
    });

    const result = await parser.getText();

    const extractedText = result.text;

    await parser.destroy();

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "No text was found in this PDF." },
        { status: 400 }
      );
    }

    // Make sure documents folder exists
    await mkdir(documentsDirectory, {
      recursive: true,
    });

    // Save the extracted text for future use
    await writeFile(
      textFilePath,
      extractedText,
      "utf8"
    );

    return NextResponse.json({
      documentId,
      extractedText,
    });
  } catch (error) {
    console.error("Document text error:", error);

    return NextResponse.json(
      {
        error: "Unable to load document text.",
      },
      { status: 500 }
    );
  }
}