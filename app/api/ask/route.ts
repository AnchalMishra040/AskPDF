import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

type Source = {
  fileName: string;
  pageNumber?: number;
};

export async function POST(request: Request) {
  try {
    const { question, documentId } = await request.json();

    if (!question || !documentId) {
      return NextResponse.json(
        {
          error: "Question and document are required",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const fileSearchStore =
      process.env.GEMINI_FILE_SEARCH_STORE;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Gemini API key is not configured.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    /*
     * ------------------------------------------------
     * FILE SEARCH
     * ------------------------------------------------
     */

    if (fileSearchStore) {
      try {
        console.log(
          `Searching File Search for document: ${documentId}`
        );

        let interaction: any = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            interaction = await ai.interactions.create({
              model: "gemini-3.8-flash",

              input: `
You are AskPDF, an AI assistant that answers questions from PDF documents.

Answer the user's question using information from the uploaded PDF.

Important instructions:
- Use the PDF as the source of information.
- Do not use outside knowledge.
- If the information is present in the PDF, answer it clearly.
- If you cannot find the information in the PDF, say:
"I couldn't find this information in the uploaded PDF."

USER QUESTION:
${question}
`,

              tools: [
                {
                  type: "file_search",
                  file_search_store_names: [
                    fileSearchStore,
                  ],

                  metadata_filter:
                    `documentId="${documentId}"`,
                },
              ],
            });

            break;
          } catch (error: any) {
            console.error(
              `File Search request failed on attempt ${attempt}:`,
              error
            );

            if (
              error?.status === 503 &&
              attempt < 3
            ) {
              await wait(attempt * 2000);
              continue;
            }

            throw error;
          }
        }

        let answer = "";
        const sources: Source[] = [];

        if (interaction?.steps) {
          for (const step of interaction.steps) {
            if (step.type !== "model_output") {
              continue;
            }

            for (const contentBlock of step.content || []) {
              if (contentBlock.type !== "text") {
                continue;
              }

              if (contentBlock.text) {
                answer += contentBlock.text;
              }

              const annotations =
                contentBlock.annotations || [];

              for (const annotation of annotations) {
                if (
                  annotation.type ===
                  "file_citation"
                ) {
                  sources.push({
                    fileName:
                      annotation.file_name ||
                      "Uploaded PDF",

                    pageNumber:
                      annotation.pageNumber,
                  });
                }
              }
            }
          }
        }

        const uniqueSources = sources.filter(
          (source, index, array) => {
            return (
              index ===
              array.findIndex(
                (item) =>
                  item.fileName ===
                    source.fileName &&
                  item.pageNumber ===
                    source.pageNumber
              )
            );
          }
        );

        console.log(
          "File Search answer:",
          answer
        );

        console.log(
          "Sources:",
          uniqueSources
        );

        /*
         * Only use File Search answer if it
         * actually found useful information.
         */
        const couldNotFind =
          answer
            .toLowerCase()
            .includes(
              "i couldn't find this information"
            );

        if (
          answer.trim() &&
          !couldNotFind
        ) {
          console.log(
            "Using File Search answer."
          );

          return NextResponse.json({
            answer: answer.trim(),
            sources: uniqueSources,
          });
        }

        console.log(
          "File Search did not find a useful answer. Using direct PDF fallback."
        );
      } catch (fileSearchError) {
        console.error(
          "File Search failed. Using direct PDF fallback:",
          fileSearchError
        );
      }
    }

    /*
     * ------------------------------------------------
     * DIRECT PDF FALLBACK
     * ------------------------------------------------
     */

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    const files = await readdir(
      uploadDirectory
    );

    const pdfFileName = files.find(
      (fileName) =>
        fileName.startsWith(
          `${documentId}-`
        ) &&
        fileName
          .toLowerCase()
          .endsWith(".pdf")
    );

    if (!pdfFileName) {
      return NextResponse.json(
        {
          error:
            "The selected PDF could not be found.",
        },
        { status: 404 }
      );
    }

    const pdfFilePath = path.join(
      uploadDirectory,
      pdfFileName
    );

    const pdfBuffer =
      await readFile(pdfFilePath);

    const pdfBase64 =
      pdfBuffer.toString("base64");

    const prompt = `
You are AskPDF, an AI assistant that answers questions from PDF documents.

Answer the user's question using ONLY the information contained in the uploaded PDF.

IMPORTANT:
- The PDF may be a normal text PDF or a scanned/image-based PDF.
- Carefully examine the visual content of relevant pages.
- If the PDF contains scanned pages, read the text from those pages.
- Do not assume that the PDF has a selectable text layer.
- If the answer is present anywhere in the PDF, provide it clearly.
- If the answer genuinely cannot be found in the PDF, say:
"I couldn't find this information in the uploaded PDF."

Keep the answer clear, simple and relevant.

USER QUESTION:
${question}
`;

    let response: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `Sending PDF directly to Gemini. Attempt ${attempt}...`
        );

        response =
          await ai.models.generateContent({
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
                      mimeType:
                        "application/pdf",
                      data: pdfBase64,
                    },
                  },
                ],
              },
            ],
          });

        break;
      } catch (error: any) {
        console.error(
          `Gemini fallback failed on attempt ${attempt}:`,
          error
        );

        if (
          error?.status === 503 &&
          attempt < 3
        ) {
          await wait(attempt * 2000);
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json({
      answer:
        response?.text ||
        "No answer received.",

      sources: [],
    });
  } catch (error: any) {
    console.error(
      "Ask error:",
      error
    );

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