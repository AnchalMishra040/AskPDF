"use client";

import { useRef, useState } from "react";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-2xl font-bold">AskPDF</h1>

          <span className="text-sm text-slate-400">
            AI Document Assistant
          </span>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Chat with your documents
          </h2>

          <p className="mt-4 text-lg text-slate-400">
            Upload a PDF and ask questions using AI.
          </p>
        </div>

        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 px-6 py-16 text-center">
            <div className="mb-4 text-5xl">📄</div>

            <h3 className="text-xl font-semibold">
              Upload your PDF
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Select a PDF to get started.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (!file) return;

                setError("");

                if (file.type !== "application/pdf") {
                  setError("Please select a PDF file only.");
                  setSelectedFile(null);
                  return;
                }

                if (file.size > 20 * 1024 * 1024) {
                  setError("PDF size must be less than 20MB.");
                  setSelectedFile(null);
                  return;
                }

                setSelectedFile(file);
              }}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-medium transition hover:bg-blue-700"
            >
              Upload PDF
            </button>

            {selectedFile && (
              <div className="mt-6 w-full rounded-lg border border-green-800 bg-green-950/30 p-4 text-left">
                <p className="font-medium text-green-400">
                  ✓ PDF selected successfully
                </p>

                <p className="mt-2 break-all text-sm text-slate-300">
                  {selectedFile.name}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <h3 className="mb-4 text-xl font-semibold">
            My Documents
          </h3>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-slate-400">
              No documents uploaded yet.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}