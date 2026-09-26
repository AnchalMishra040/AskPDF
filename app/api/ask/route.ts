import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function POST(request: Request) {
  try {
    const { question, documentId } = await request.json();

    if (!question || !documentId) {
      return NextResponse.json(
        { error: "Question and document are required" },
        { status: 400 }
      );
    }

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    // Find the uploaded PDF using its document ID
    const files = await readdir(uploadDirectory);

    const pdfFileName = files.find(
      (fileName) =>
        fileName.startsWith(`${documentId}-`) &&
        fileName.toLowerCase().endsWith(".pdf")
    );

    if (!pdfFileName) {
      return NextResponse.json(
        { error: "The selected PDF could not be found." },
        { status: 404 }
      );
    }

    const pdfFilePath = path.join(
      uploadDirectory,
      pdfFileName
    );

    // Read the original PDF
    const pdfBuffer = await readFile(pdfFilePath);

    // Convert PDF to base64 for Gemini
    const pdfBase64 = pdfBuffer.toString("base64");

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
You are AskPDF, an AI assistant that answers questions from PDF documents.

Answer the user's question using ONLY the information contained in the uploaded PDF.

IMPORTANT:
- The PDF may be a normal text PDF or a scanned/image-based PDF.
- Carefully examine the visual content of every relevant page.
- If the PDF contains scanned pages, read the text from those pages.
- Do not assume that the PDF has a selectable text layer.
- If the answer is present anywhere in the PDF, provide it clearly.
- If the answer genuinely cannot be found in the PDF, say:
"I couldn't find this information in the uploaded PDF."

Keep the answer clear, simple and relevant.

USER QUESTION:
${question}
`;

    let response;

    // Try the Gemini request up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.6-flash",

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64,
                  },
                },
              ],
            },
          ],
        });

        break;
      } catch (error: any) {
        const status = error?.status;

        console.error(
          `Gemini request failed on attempt ${attempt}:`,
          error
        );

        // Retry only when Gemini is temporarily unavailable
        if (status === 503 && attempt < 3) {
          const delay = attempt * 2000;

          console.log(
            `Gemini is temporarily busy. Retrying in ${
              delay / 1000
            } seconds...`
          );

          await wait(delay);
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json({
      answer: response?.text || "No answer received.",
    });
  } catch (error: any) {
    console.error("Ask error:", error);

    if (error?.status === 503) {
      return NextResponse.json(
        {
          error:
            "The AI service is temporarily busy. Please try again in a moment.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Something went wrong while getting the AI answer.",
      },
      { status: 500 }
    );
  }
}