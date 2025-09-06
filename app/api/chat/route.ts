// app/api/chat/route.ts

// Force this route to use Node.js runtime (required for Pinecone vector database operations)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { openai } from "../../../lib/openai"; // OpenAI API client
import { getPinecone } from "../../../lib/pinecone"; // Pinecone vector database client

// Define the structure of conversation history messages
type HistoryMsg = { role: "user" | "assistant"; content: string };

// Define the expected request body structure
type Body = {
  question: string; // User's query (required)
  k?: number; // Number of results to return (optional)
  documentIds?: string[]; // Filter by specific documents (optional)
  fileTypes?: string[]; // Filter by file types (optional)
  history?: HistoryMsg[]; // Conversation history for context (optional)
};

/**
 * Escapes special regex characters in a string
 * This prevents regex injection attacks when using user input in regular expressions
 */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Creates a text snippet with query terms highlighted by context
 * This helps users see why a particular document chunk was retrieved
 *
 * @param text - The full text to extract a snippet from
 * @param query - The search query to center the snippet around
 * @param radius - Number of characters to show around the matched term
 * @returns A contextual snippet with the query term in the middle
 */
function makeSnippet(text: string, query: string, radius = 220) {
  if (!text) return "";

  // Extract up to 5 search terms from the query
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);

  // If no meaningful terms, return beginning of text
  if (!terms.length) {
    return text.length > radius * 2 ? text.slice(0, radius * 2) + "…" : text;
  }

  // Find the first occurrence of any search term
  const hay = text.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = hay.indexOf(t);
    if (i >= 0) {
      idx = i;
      break;
    }
  }

  // If no term found, return beginning of text
  if (idx < 0) {
    return text.length > radius * 2 ? text.slice(0, radius * 2) + "…" : text;
  }

  // Extract a window around the found term
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + terms[0].length + radius);
  let snip = text.slice(start, end).trim();

  // Add ellipsis if we're not at the beginning/end
  if (start > 0) snip = "…" + snip;
  if (end < text.length) snip = snip + "…";

  return snip;
}

/**
 * Packages search results into a formatted context for the AI
 * This is a critical RAG step that prepares retrieved information for the LLM
 *
 * @param matches - Search results from the vector database
 * @param question - The original user question
 * @param charBudget - Maximum characters for the context (to fit in model's context window)
 * @returns Formatted context and source information for citations
 */
function packContext(matches: any[], question: string, charBudget = 2400) {
  const sources: Array<{
    idx: number; // Source index for citation [1], [2], etc.
    documentId: string; // ID of the source document
    filename: string; // Name of the source file
    chunkIndex: number; // Which chunk of the document
    snippet: string; // Contextual snippet showing relevant text
    score: number; // Similarity score (0-1)
  }> = [];

  let ctx = ""; // The formatted context that will be sent to the AI
  let idx = 1; // Counter for source citations

  // Process each search result
  for (const m of matches) {
    const content = (m.metadata?.content as string) || "";
    if (!content) continue;

    // Create a contextual snippet centered around the query
    const snippet = makeSnippet(content, question);
    const line = `[${idx}] ${m.metadata?.filename} (chunk ${m.metadata?.chunkIndex}): ${snippet}\n\n`;

    // Stop if we're about to exceed the character budget
    if (ctx.length + line.length > charBudget) break;

    // Add to sources and context
    sources.push({
      idx,
      documentId: m.metadata?.documentId,
      filename: m.metadata?.filename,
      chunkIndex: m.metadata?.chunkIndex,
      snippet,
      score: m.score ?? 0,
    });
    ctx += line;
    idx++;
  }

  return { sources, context: ctx.trim() };
}

/**
 * RAG (Retrieval Augmented Generation) Chat API Endpoint
 *
 * This endpoint implements the core RAG pattern:
 * 1. Convert question to vector embedding
 * 2. Retrieve relevant document chunks from vector database
 * 3. Package context for the AI
 * 4. Generate answer based on retrieved context
 *
 * RAG enhances AI responses by grounding them in your specific documents
 * rather than relying solely on the model's training data
 */
export async function POST(req: Request) {
  try {
    // Parse and validate the request
    const body = (await req.json()) as Body;
    const question = body?.question?.trim();
    if (!question) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }

    // Set parameters with defaults
    const k = body?.k ?? 5; // Number of results to retrieve
    const { documentIds, fileTypes } = body;

    // 1) EMBED THE QUESTION: Convert text to numerical vector
    // Embeddings capture semantic meaning in a format computers can compare
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small", // OpenAI's efficient embedding model
      input: question,
    });
    const vector = emb.data[0].embedding; // 1536-dimensional vector representing the question

    // 2) QUERY VECTOR DATABASE: Find similar content in your documents
    const { index } = getPinecone();

    // Build optional filters to narrow search to specific documents or file types
    let filter: Record<string, any> | undefined;
    if (
      (documentIds && documentIds.length) ||
      (fileTypes && fileTypes.length)
    ) {
      filter = {};
      if (documentIds?.length) filter.documentId = { $in: documentIds };
      if (fileTypes?.length) filter.fileType = { $in: fileTypes };
    }

    // Search for similar vectors in the database
    const res = await index.query({
      vector, // The embedding of our question
      topK: Math.max(k, 8), // Retrieve slightly more than requested to allow for filtering
      includeMetadata: true, // Return the associated document text and metadata
      filter, // Optional filters
    } as any);

    const matches = Array.isArray(res.matches) ? res.matches : [];

    // Quality check: if no good matches found, return early
    const best = matches[0]?.score ?? 0; // Similarity score (0 = no similarity, 1 = identical)
    if (!matches.length || best < 0.15) {
      return NextResponse.json({
        answer:
          "I don't have enough information in the uploaded documents to answer that.",
        sources: [],
      });
    }

    // 3) BUILD CONTEXT: Format retrieved information for the AI
    const { sources, context } = packContext(matches, question, 2400);

    // 4) PREPARE MESSAGES FOR AI: System prompt + history + context
    const system = [
      "You are a helpful assistant that answers ONLY from the provided context.",
      'If the answer is not in the context, say: "I don\'t have enough information in the uploaded documents to answer that."',
      "Keep answers concise. Include inline citations like [1], [2] that refer to the sources list.",
    ].join(" ");

    const user = [
      `Question:\n${question}\n`,
      `Context (excerpts):\n${context || "(no context)"}`,
      "\nInstructions:",
      "- Answer using only the context excerpts above.",
      "- When a sentence comes from an excerpt, add [n] with the correct number.",
      "- If the context is insufficient, say so plainly.",
    ].join("\n");

    // Build message history (last 4 messages for context)
    const messages = [
      { role: "system" as const, content: system }, // System instructions
      ...(body.history?.slice(-4) || []), // Recent conversation history
      { role: "user" as const, content: user }, // Current question with context
    ];

    // 5) CALL AI MODEL: Generate answer based on retrieved context
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Efficient yet capable model
      temperature: 0.2, // Low temperature for more focused, deterministic responses
      messages, // The prepared message history
    });

    const answer = chat.choices?.[0]?.message?.content || "";

    // Return the AI's answer with source information for verification
    return NextResponse.json({
      answer,
      sources: sources.map((s) => ({
        documentId: s.documentId,
        filename: s.filename,
        chunkIndex: s.chunkIndex,
        snippet: s.snippet,
        score: s.score,
      })),
    });
  } catch (e: any) {
    // Handle any unexpected errors
    return NextResponse.json(
      { error: e?.message || "chat route error" },
      { status: 500 }
    );
  }
}
