import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    const files = await readdir(uploadDirectory);

    const documents = await Promise.all(
      files
        .filter((file) => file.toLowerCase().endsWith(".pdf"))
        .map(async (file) => {
          const filePath = path.join(uploadDirectory, file);
          const fileStats = await stat(filePath);

          // The document ID is the UUID at the beginning of the filename
          const documentId = file.split("-").slice(0, 5).join("-");

          return {
            documentId,
            fileName: file,
            fileSize: fileStats.size,
            fileUrl: `/uploads/${file}`,
          };
        })
    );

    return NextResponse.json({
      documents,
    });
  } catch (error) {
    console.error("Documents error:", error);

    return NextResponse.json(
      { error: "Unable to load documents" },
      { status: 500 }
    );
  }
}