"use client";

import { useEffect, useRef, useState } from "react";

type UploadedDocument = {
  documentId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
};

type Source = {
  fileName: string;
  pageNumber?: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  const [error, setError] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [selectedDocumentName, setSelectedDocumentName] =
    useState("");
  const [message, setMessage] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] =
    useState(true);
  const [isLoadingDocument, setIsLoadingDocument] =
    useState(false);

  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [thinkingMessage, setThinkingMessage] = useState(
    "Searching your document..."
  );
  const [lastAskedQuestion, setLastAskedQuestion] =
    useState("");

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    []
  );

  /*
   * ------------------------------------------------
   * AI LOADING MESSAGE
   * ------------------------------------------------
   */

  useEffect(() => {
    if (!isAsking) {
      setThinkingMessage("Searching your document...");
      return;
    }

    setThinkingMessage("Searching your document...");

    const timer = setTimeout(() => {
      setThinkingMessage(
        "This is taking a little longer..."
      );
    }, 8000);

    return () => {
      clearTimeout(timer);
    };
  }, [isAsking]);

  /*
   * ------------------------------------------------
   * FETCH DOCUMENTS
   * ------------------------------------------------
   */

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

  /*
   * ------------------------------------------------
   * FILE SELECTION
   * ------------------------------------------------
   */

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");
    setAskError("");
    setQuestion("");
    setLastAskedQuestion("");
    setDocumentId("");
    setSelectedDocumentName("");
    setExtractedText("");
    setChatMessages([]);

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file only.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("PDF size must be less than 50MB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  /*
   * ------------------------------------------------
   * UPLOAD PDF
   * ------------------------------------------------
   */

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
    setLastAskedQuestion("");

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
      setSelectedDocumentName(data.fileName || "");
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

  /*
   * ------------------------------------------------
   * SELECT DOCUMENT FOR CHAT
   * ------------------------------------------------
   */

  const handleChat = async (
    selectedDocumentId: string,
    selectedFileName: string
  ) => {
    setIsLoadingDocument(true);
    setError("");
    setMessage("");
    setAskError("");
    setQuestion("");
    setLastAskedQuestion("");
    setExtractedText("");
    setChatMessages([]);
    setDocumentId(selectedDocumentId);
    setSelectedDocumentName(selectedFileName);

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

  /*
   * ------------------------------------------------
   * CLEAR CHAT
   * ------------------------------------------------
   */

  const handleClearChat = () => {
    setChatMessages([]);
    setQuestion("");
    setAskError("");
    setLastAskedQuestion("");
  };

  /*
   * ------------------------------------------------
   * ASK AI
   * ------------------------------------------------
   */

  const handleAsk = async (
    questionOverride?: string
  ) => {
    const userQuestion = (
      questionOverride ?? question
    ).trim();

    if (!userQuestion) {
      setAskError("Please enter a question.");
      return;
    }

    if (!documentId) {
      setAskError("Please select a document first.");
      return;
    }

    if (isAsking) {
      return;
    }

    setIsAsking(true);
    setAskError("");
    setQuestion("");
    setLastAskedQuestion(userQuestion);

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

      setChatMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: data.answer || "No answer received.",
          sources: data.sources || [],
        },
      ]);
    } catch (error) {
      console.error("Ask AI error:", error);

      setAskError(
        "Unable to connect with AI. Please try again."
      );
    } finally {
      setIsAsking(false);
    }
  };

  /*
   * ------------------------------------------------
   * PAGE
   * ------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-[#070b18] text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-20 border-b border-white/5 bg-[#070b18]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/15 text-lg ring-1 ring-blue-500/20">
              ✦
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                AskPDF
              </h1>

              <p className="text-[11px] text-slate-500">
                AI Document Assistant
              </p>
            </div>
          </div>

          <div className="hidden rounded-full border border-white/5 bg-white/[0.03] px-4 py-2 text-xs text-slate-400 sm:block">
            Read • Ask • Understand
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-blue-950/40 via-[#0c1224] to-[#0a0f1d] px-6 py-12 sm:px-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/10 bg-blue-500/5 px-3 py-1.5 text-xs text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Your documents, made easier
            </div>

            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Chat with your
              <span className="text-blue-400">
                {" "}
                documents.
              </span>
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Upload a PDF, let AskPDF understand it, and get
              clear answers from your document in seconds.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-2">
                ✦ Text PDFs
              </span>

              <span className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-2">
                ◈ Scanned PDFs
              </span>

              <span className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-2">
                ⌁ AI Q&A
              </span>
            </div>
          </div>
        </div>

        {/* Upload + Stats */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Upload card */}
          <div className="rounded-2xl border border-white/5 bg-[#0d1324] p-6 shadow-2xl shadow-black/10 sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-medium text-blue-400">
                GET STARTED
              </p>

              <h3 className="mt-2 text-2xl font-semibold">
                Upload a document
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                PDF files up to 50 MB are supported.
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-700/80 bg-[#080d1a] px-5 py-10 text-center transition hover:border-blue-500/40">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl ring-1 ring-blue-500/10">
                📄
              </div>

              <h4 className="mt-5 font-medium">
                Choose your PDF
              </h4>

              <p className="mt-2 text-sm text-slate-500">
                Upload notes, papers, reports or study material.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium transition hover:bg-blue-500"
              >
                Choose PDF
              </button>

              {selectedFile && (
                <div className="mx-auto mt-6 max-w-md rounded-xl border border-green-500/10 bg-green-500/5 p-4 text-left">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">✓</span>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-green-400">
                        PDF ready to upload
                      </p>

                      <p className="mt-1 break-all text-sm text-slate-300">
                        {selectedFile.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {(
                          selectedFile.size /
                          (1024 * 1024)
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading
                      ? "Processing PDF..."
                      : "Upload to AskPDF"}
                  </button>
                </div>
              )}

              {message && (
                <p className="mt-5 text-sm text-green-400">
                  ✓ {message}
                </p>
              )}

              {error && (
                <p className="mt-5 text-sm text-red-400">
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Small info cards */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/5 bg-[#0d1324] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                📚
              </div>

              <h4 className="mt-4 font-medium">
                Understand PDFs
              </h4>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Ask questions directly from your documents.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0d1324] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                🔍
              </div>

              <h4 className="mt-4 font-medium">
                Scanned PDF support
              </h4>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Ask questions from image-based documents too.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0d1324] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                💬
              </div>

              <h4 className="mt-4 font-medium">
                Continue the conversation
              </h4>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Ask multiple questions without losing context.
              </p>
            </div>
          </div>
        </div>

        {/* Loading selected document */}
        {isLoadingDocument && (
          <div className="mt-8 rounded-2xl border border-blue-500/10 bg-blue-500/5 p-5 text-center">
            <p className="text-sm text-blue-300">
              Loading your document...
            </p>
          </div>
        )}

        {/* Chat */}
        {documentId &&
          extractedText &&
          !isLoadingDocument && (
            <div className="mt-8 rounded-2xl border border-white/5 bg-[#0d1324] p-6 shadow-xl shadow-black/10 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-400">
                    DOCUMENT CHAT
                  </p>

                  <h3 className="mt-1 text-2xl font-semibold">
                    Ask a question
                  </h3>

                  {selectedDocumentName && (
                    <p className="mt-2 break-all text-sm text-slate-500">
                      📄 {selectedDocumentName}
                    </p>
                  )}
                </div>

                {chatMessages.length > 0 && !isAsking && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
                  >
                    Clear chat
                  </button>
                )}
              </div>

              <div className="mt-6">
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
                  placeholder="Ask something about your document..."
                  rows={4}
                  disabled={isAsking}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#080d1a] p-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-600">
                    Press Enter to ask • Shift + Enter for a new line
                  </p>

                  <button
                    type="button"
                    onClick={() => handleAsk()}
                    disabled={isAsking}
                    className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAsking
                      ? "Thinking..."
                      : "Ask AI →"}
                  </button>
                </div>
              </div>

              {/* Error + Retry */}
              {askError && (
                <div className="mt-5 rounded-xl border border-red-500/10 bg-red-500/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-400">
                        ⚠ Something went wrong
                      </p>

                      <p className="mt-1 text-sm text-red-300/70">
                        {askError}
                      </p>
                    </div>

                    {lastAskedQuestion && !isAsking && (
                      <button
                        type="button"
                        onClick={() =>
                          handleAsk(lastAskedQuestion)
                        }
                        className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
                      >
                        ↻ Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {chatMessages.length > 0 && (
                <div className="mt-8 space-y-4">
                  {chatMessages.map((chatMessage, index) => (
                    <div
                      key={index}
                      className={
                        chatMessage.role === "user"
                          ? "rounded-2xl border border-blue-500/10 bg-blue-500/5 p-5"
                          : "rounded-2xl border border-white/5 bg-[#080d1a] p-5"
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            chatMessage.role === "user"
                              ? "text-sm font-semibold text-blue-400"
                              : "text-sm font-semibold text-emerald-400"
                          }
                        >
                          {chatMessage.role === "user"
                            ? "You"
                            : "✦ AskPDF"}
                        </span>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {chatMessage.content}
                      </p>

                      {/* Sources */}
                      {chatMessage.role === "assistant" &&
                        chatMessage.sources &&
                        chatMessage.sources.length > 0 && (
                          <div className="mt-5 border-t border-white/5 pt-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              📚 Sources
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {chatMessage.sources.map(
                                (source, sourceIndex) => (
                                  <span
                                    key={`${source.fileName}-${source.pageNumber}-${sourceIndex}`}
                                    className="rounded-lg border border-blue-500/10 bg-blue-500/5 px-3 py-2 text-xs text-blue-300"
                                  >
                                    📄{" "}
                                    {source.pageNumber
                                      ? `Page ${source.pageNumber}`
                                      : source.fileName}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}

                  {/* AI Loading */}
                  {isAsking && (
                    <div className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" />
                        </div>

                        <p className="text-sm text-slate-400">
                          {thinkingMessage}
                        </p>
                      </div>

                      <p className="mt-2 text-xs text-slate-600">
                        AskPDF is processing your document. This may
                        take a little longer for large or scanned PDFs.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Documents */}
        <div className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-400">
                YOUR LIBRARY
              </p>

              <h3 className="mt-1 text-2xl font-semibold">
                My Documents
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your uploaded PDFs in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchDocuments}
              className="self-start rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white sm:self-auto"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="mt-5">
            {isLoadingDocuments ? (
              <div className="rounded-2xl border border-white/5 bg-[#0d1324] p-8 text-center">
                <p className="text-sm text-slate-500">
                  Loading documents...
                </p>
              </div>
            ) : documents.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {documents.map((document) => (
                  <div
                    key={document.fileUrl}
                    className="group rounded-2xl border border-white/5 bg-[#0d1324] p-5 transition hover:-translate-y-0.5 hover:border-blue-500/20"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
                        📄
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-medium text-white">
                          {document.fileName}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-500">
                            {(
                              document.fileSize /
                              (1024 * 1024)
                            ).toFixed(2)}{" "}
                            MB
                          </span>

                          <span className="rounded-full bg-emerald-500/5 px-2.5 py-1 text-emerald-400">
                            Available
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-center text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                      >
                        Open PDF
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          handleChat(
                            document.documentId,
                            document.fileName
                          )
                        }
                        disabled={isLoadingDocument}
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Chat →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1324] p-10 text-center">
                <div className="text-3xl">📚</div>

                <p className="mt-4 font-medium">
                  Your library is empty
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Upload your first PDF to get started.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Extracted text */}
        {extractedText && (
          <details className="mt-8 rounded-2xl border border-white/5 bg-[#0d1324]">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-400">
              View extracted text preview
            </summary>

            <div className="border-t border-white/5 px-5 py-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-500">
                {extractedText}
              </p>
            </div>
          </details>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-6 text-center">
        <p className="text-xs text-slate-600">
          AskPDF • AI Document Assistant
        </p>
      </footer>
    </main>
  );
}