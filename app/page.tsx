"use client";

import { useEffect, useRef, useState } from "react";

type UploadedDocument = {
  documentId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  const [error, setError] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  // Document loading state
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  // AI states
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState("");

  // Chat history
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    []
  );

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to fetch documents.");
        return;
      }

      setDocuments(data.documents);
    } catch (error) {
      console.error("Documents fetch error:", error);
      setError("Unable to load documents.");
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");
    setAskError("");
    setQuestion("");
    setDocumentId("");
    setExtractedText("");
    setChatMessages([]);

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
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a PDF file first.");
      return;
    }

    setIsUploading(true);
    setError("");
    setMessage("");
    setAskError("");
    setChatMessages([]);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Upload failed.");
        return;
      }

      setMessage(data.message);
      setExtractedText(data.extractedText || "");
      setDocumentId(data.documentId || "");
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);
      setError("Unable to upload PDF. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Load selected document
  const handleChat = async (selectedDocumentId: string) => {
    setIsLoadingDocument(true);
    setError("");
    setMessage("");
    setAskError("");
    setQuestion("");
    setExtractedText("");
    setChatMessages([]);
    setDocumentId(selectedDocumentId);

    try {
      const response = await fetch(
        `/api/document-text?documentId=${encodeURIComponent(
          selectedDocumentId
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Unable to load the selected document."
        );
        return;
      }

      setExtractedText(data.extractedText || "");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("Document loading error:", error);
      setError("Unable to load the selected document.");
    } finally {
      setIsLoadingDocument(false);
    }
  };

  // Ask AI
  const handleAsk = async () => {
    if (!question.trim()) {
      setAskError("Please enter a question.");
      return;
    }

    if (!documentId) {
      setAskError("Please select a document first.");
      return;
    }

    const userQuestion = question.trim();

    setIsAsking(true);
    setAskError("");
    setQuestion("");

    // Add user's question immediately to chat
    setChatMessages((previousMessages) => [
      ...previousMessages,
      {
        role: "user",
        content: userQuestion,
      },
    ]);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
          documentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAskError(
          data.error || "Unable to get an answer from AI."
        );
        return;
      }

      // Add AI answer to chat
      setChatMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: data.answer || "No answer received.",
        },
      ]);
    } catch (error) {
      console.error("Ask AI error:", error);

      setAskError("Unable to connect with AI. Please try again.");
    } finally {
      setIsAsking(false);
    }
  };

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

        {/* Upload Section */}
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 px-6 py-16 text-center">
            <div className="mb-4 text-5xl">📄</div>

            <h3 className="text-xl font-semibold">
              Upload your PDF
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Select a PDF to upload it to AskPDF.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-medium transition hover:bg-blue-700"
            >
              Choose PDF
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

                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="mt-4 rounded-lg bg-green-600 px-5 py-2 font-medium transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading
                    ? "Uploading..."
                    : "Upload to AskPDF"}
                </button>
              </div>
            )}

            {message && (
              <p className="mt-4 text-sm text-green-400">
                {message}
              </p>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Selected Document Loading */}
        {isLoadingDocument && (
          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-blue-900 bg-slate-900 p-5 text-center">
            <p className="text-blue-400">
              Loading selected document...
            </p>
          </div>
        )}

        {/* Ask AI Section */}
        {documentId && extractedText && !isLoadingDocument && (
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-blue-900 bg-slate-900 p-8">
            <h2 className="text-2xl font-bold">
              💬 Ask a Question
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Ask anything about your selected PDF.
            </p>

            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setAskError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();

                  if (!isAsking) {
                    handleAsk();
                  }
                }
              }}
              placeholder="Example: What is this document about?"
              rows={4}
              className="mt-5 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-4 text-white outline-none transition focus:border-blue-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              Press Enter to ask or Shift + Enter for a new line.
            </p>

            <button
              onClick={handleAsk}
              disabled={isAsking}
              className="mt-4 rounded-lg bg-blue-600 px-6 py-3 font-medium transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAsking ? "Thinking..." : "Ask AI"}
            </button>

            {askError && (
              <p className="mt-4 text-sm text-red-400">
                {askError}
              </p>
            )}

            {/* Chat History */}
            {chatMessages.length > 0 && (
              <div className="mt-8 space-y-4">
                {chatMessages.map((chatMessage, index) => (
                  <div
                    key={index}
                    className={`rounded-xl p-5 ${
                      chatMessage.role === "user"
                        ? "border border-blue-900 bg-blue-950/30"
                        : "border border-slate-700 bg-slate-950"
                    }`}
                  >
                    <h3
                      className={`mb-2 text-sm font-semibold ${
                        chatMessage.role === "user"
                          ? "text-blue-400"
                          : "text-green-400"
                      }`}
                    >
                      {chatMessage.role === "user"
                        ? "You"
                        : "🤖 AI"}
                    </h3>

                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                      {chatMessage.content}
                    </p>
                  </div>
                ))}

                {isAsking && (
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                    <p className="text-sm text-slate-400">
                      🤖 AI is thinking...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* My Documents */}
        <div className="mx-auto mt-10 max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">
              My Documents
            </h3>

            <button
              onClick={fetchDocuments}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          {isLoadingDocuments ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
              <p className="text-slate-400">
                Loading documents...
              </p>
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((document) => (
                <div
                  key={document.fileUrl}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-all font-medium text-white">
                        📄 {document.fileName}
                      </p>

                      <p className="mt-2 text-sm text-slate-400">
                        Size:{" "}
                        {(document.fileSize / (1024 * 1024)).toFixed(
                          2
                        )}{" "}
                        MB
                      </p>

                      <p className="mt-1 text-sm text-green-400">
                        Available
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium transition hover:bg-blue-700"
                      >
                        Open PDF
                      </a>

                      <button
                        onClick={() =>
                          handleChat(document.documentId)
                        }
                        disabled={isLoadingDocument}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Chat
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
              <p className="text-slate-400">
                No documents uploaded yet.
              </p>
            </div>
          )}
        </div>

        {/* Extracted Text Preview */}
        {extractedText && (
          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="mb-3 text-xl font-semibold text-white">
              Extracted Text Preview
            </h2>

            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {extractedText}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}