// components/ChatBox.tsx
"use client"; // This marks the component as a Client Component in Next.js

import { useState, useRef, useEffect } from "react";

// Define the structure of a source citation
type Source = {
  documentId: string; // Unique identifier for the document
  filename: string; // Name of the source file
  chunkIndex: number; // Which chunk of the document was used
  snippet: string; // Relevant text excerpt from the document
  score: number; // Similarity score (0-1) indicating relevance
};

// Define the structure of a chat message
type Msg = {
  id: string; // Unique identifier for the message
  role: "user" | "assistant"; // Who sent the message
  content: string; // The message text
  sources?: Source[]; // Optional sources for assistant messages
};

/**
 * ChatBox Component - RAG-Powered Document Q&A Interface
 *
 * This component provides a chat interface where users can ask questions about
 * their uploaded documents. It uses a RAG (Retrieval Augmented Generation)
 * system to find relevant information in documents and generate answers.
 */
export default function ChatBox() {
  // State for the current question input
  const [q, setQ] = useState("");
  // State to track when an API request is in progress
  const [busy, setBusy] = useState(false);
  // State for any error messages
  const [err, setErr] = useState<string | null>(null);
  // State for the chat message history
  const [messages, setMessages] = useState<Msg[]>([]);
  // Reference to the message container for auto-scrolling
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Effect to automatically scroll to the bottom when new messages are added
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages.length]);

  /**
   * Handles sending a question to the RAG API and processing the response
   *
   * This function:
   * 1. Validates the question
   * 2. Adds the user's question to the chat history
   * 3. Sends the question and recent history to the API
   * 4. Processes the AI's response with sources
   * 5. Handles any errors that occur
   */
  async function ask() {
    const question = q.trim();
    // Don't proceed if question is empty or a request is already in progress
    if (!question || busy) return;

    setErr(null);
    setBusy(true);

    // Create a user message object with a unique ID
    const userMsg: Msg = {
      id: crypto.randomUUID(), // Generate a unique identifier
      role: "user",
      content: question,
    };

    // Add the user's message to the chat history
    setMessages((prev) => [...prev, userMsg]);
    setQ(""); // Clear the input field

    try {
      // Prepare conversation history (last 4 messages for context)
      const history = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Send the question to the RAG API endpoint
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });

      // Parse the API response
      const data = await res.json();

      // Throw an error if the API response indicates failure
      if (!res.ok) throw new Error(data?.error || "Chat failed");

      // Create an assistant message with the answer and sources
      const asst: Msg = {
        id: crypto.randomUUID(), // Generate a unique identifier
        role: "assistant",
        content: data.answer || "", // The AI-generated answer
        sources: data.sources || [], // Source documents used for the answer
      };

      // Add the assistant's response to the chat history
      setMessages((prev) => [...prev, asst]);
    } catch (e: any) {
      // Display any errors that occurred during the API call
      setErr(e?.message || "Chat failed");
    } finally {
      // Reset the busy state regardless of success or failure
      setBusy(false);
    }
  }

  // Render the chat interface
  return (
    <div className="space-y-3">
      {/* Input area for questions */}
      <div className="flex gap-2">
        <input
          className="border p-2 rounded w-full"
          value={q}
          onChange={(e) => setQ(e.target.value)} // Update question state on input change
          placeholder="Ask about your documents…"
          onKeyDown={(e) => e.key === "Enter" && ask()} // Submit on Enter key
          disabled={busy} // Disable input when busy
        />
        <button
          onClick={ask}
          className="border px-3 rounded"
          disabled={busy || !q.trim()} // Disable if busy or no question
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </div>

      {/* Error display */}
      {err && <div className="text-sm text-red-600">{err}</div>}

      {/* Message history container */}
      <div
        ref={scrollerRef} // Reference for auto-scrolling
        className="max-h-[360px] overflow-auto border rounded p-3 space-y-3"
      >
        {/* Render each message in the chat history */}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* Message bubble with different styling for user vs assistant */}
            <div
              className={`max-w-[80%] rounded p-3 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-blue-50" : "bg-gray-50"
              }`}
            >
              {/* Message content */}
              <div>{m.content}</div>

              {/* Display sources for assistant messages */}
              {m.role === "assistant" && !!m.sources?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.sources.map((s, i) => (
                    // Source citation badge
                    <div
                      key={i}
                      className="text-[11px] bg-white border rounded px-2 py-1"
                    >
                      {s.filename} • #{s.chunkIndex}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Empty state prompt */}
        {!messages.length && (
          <div className="text-xs text-gray-500">
            Ask a question to start (e.g., "Give me a 2-line summary of the
            resume.")
          </div>
        )}
      </div>
    </div>
  );
}
