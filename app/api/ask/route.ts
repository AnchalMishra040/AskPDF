import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { question, documentId } = await request.json();

    if (!question || !documentId) {
      return NextResponse.json(
        { error: "Question and document are required" },
        { status: 400 }
      );
    }

    // Find the saved text file for this document
    const textFilePath = path.join(
      process.cwd(),
      "data",
      "documents",
      `${documentId}.txt`
    );

    const extractedText = await readFile(textFilePath, "utf8");

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "No text was found in this document." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
You are AskPDF, an AI assistant that answers questions from PDF documents.

Use ONLY the information provided in the PDF text below.

If the answer is not available in the PDF, clearly say:
"I couldn't find this information in the uploaded PDF."

Keep the answer clear, simple and relevant.

PDF TEXT:
${extractedText}

USER QUESTION:
${question}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return NextResponse.json({
      answer: response.text,
    });
  } catch (error) {
    console.error("Ask error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while getting the AI answer.",
      },
      { status: 500 }
    );
  }
}