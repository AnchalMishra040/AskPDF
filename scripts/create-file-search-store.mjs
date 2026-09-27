import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  const store = await ai.fileSearchStores.create({
    config: {
      displayName: "AskPDF Document Store",
      embeddingModel: "models/gemini-embedding-2",
    },
  });

  console.log("\nFile Search Store created successfully!");
  console.log("Store name:");
  console.log(store.name);
}

main().catch((error) => {
  console.error("\nFailed to create File Search Store:");
  console.error(error);
  process.exit(1);
});
