import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    const files = await readdir(uploadDirectory);

    const documents = [];

    for (const fileName of files) {
      if (!fileName.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      const filePath = path.join(uploadDirectory, fileName);
      const fileStats = await stat(filePath);

      documents.push({
        fileName,
        fileSize: fileStats.size,
        fileUrl: `/uploads/${fileName}`,
      });
    }

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Documents fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch documents.",
      },
      { status: 500 }
    );
  }
}