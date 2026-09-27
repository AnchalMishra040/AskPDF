import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

PDFParse.setWorker(getData());

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

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

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 50 MB" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from the PDF
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const extractedText = result.text;
    const pageCount = result.total;

    await parser.destroy();

    // Local upload directory
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    await mkdir(uploadDirectory, { recursive: true });

    // Local document text directory
    const documentsDirectory = path.join(
      process.cwd(),
      "data",
      "documents"
    );

    await mkdir(documentsDirectory, { recursive: true });

    // Create a unique document ID
    const documentId = randomUUID();

    const safeFileName = `${documentId}-${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;

    const filePath = path.join(
      uploadDirectory,
      safeFileName
    );

    // Save original PDF locally
    await writeFile(filePath, buffer);

    // Save extracted text locally
    const textFilePath = path.join(
      documentsDirectory,
      `${documentId}.txt`
    );

    await writeFile(
      textFilePath,
      extractedText,
      "utf8"
    );

    // Upload the PDF to Gemini File Search
    let fileSearchIndexed = false;

    try {
      const fileSearchStore =
        process.env.GEMINI_FILE_SEARCH_STORE;

      const apiKey = process.env.GEMINI_API_KEY;

      if (!fileSearchStore || !apiKey) {
        throw new Error(
          "Gemini File Search configuration is missing."
        );
      }

      const ai = new GoogleGenAI({
        apiKey,
      });

      console.log(
        `Uploading ${file.name} to Gemini File Search...`
      );

      let operation =
        await ai.fileSearchStores.uploadToFileSearchStore({
          file: filePath,

          fileSearchStoreName: fileSearchStore,

          config: {
            displayName: file.name,

            mimeType: "application/pdf",

            customMetadata: [
              {
                key: "documentId",
                stringValue: documentId,
              },
            ],
          },
        });

      // Wait until Gemini finishes indexing the PDF
      while (!operation.done) {
        console.log(
          "Waiting for Gemini to finish indexing the PDF..."
        );

        await wait(3000);

        operation = await ai.operations.get({
          operation,
        });
      }

      if (operation.error) {
        throw new Error(
          `File Search indexing failed: ${JSON.stringify(
            operation.error
          )}`
        );
      }

      fileSearchIndexed = true;

      console.log(
        "PDF successfully indexed in Gemini File Search."
      );
    } catch (fileSearchError) {
      console.error(
        "File Search indexing error:",
        fileSearchError
      );

      // The local PDF upload still works even if
      // File Search indexing fails.
      fileSearchIndexed = false;
    }

    return NextResponse.json({
      message: fileSearchIndexed
        ? "PDF uploaded and indexed successfully."
        : "PDF uploaded successfully. AI source indexing could not be completed.",

      documentId,

      fileName: file.name,

      fileUrl: `/uploads/${safeFileName}`,

      pageCount,

      extractedText,

      textPreview: extractedText.slice(0, 1500),

      fileSearchIndexed,
    });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      {
        error:
          "Something went wrong while processing the PDF.",
      },
      { status: 500 }
    );
  }
}