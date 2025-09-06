// app/api/embedding/create/route.ts

// Force this route to use Node.js runtime (required for some libraries like Pinecone)
// This is necessary because some vector database operations require Node.js APIs
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { store } from "../../../../lib/store"; // In-memory or persistent document store
import { chunkText } from "../../../../chunk"; // Text chunking utility
import { openai } from "../../../../lib/openai"; // OpenAI client configuration
import { getPinecone } from "../../../../lib/pinecone"; // Pinecone vector database client
import type { DocumentRecord } from "../../../../lib/types"; // Type definitions

// Define the expected request body structure
type ReqBody = {
  documentId?: string; // Optional: Process a specific document
  batchSize?: number; // Optional: Custom batch size for embedding processing
};

/**
 * POST handler for creating embeddings from document content
 *
 * This endpoint:
 * 1. Accepts documents either by specific ID or finds all documents ready for embedding
 * 2. Chunks the document text into manageable pieces
 * 3. Creates embeddings for each chunk using OpenAI's API
 * 4. Stores the embeddings in Pinecone vector database
 * 5. Updates document status in the store
 *
 * Embeddings are numerical representations of text that capture semantic meaning,
 * allowing similarity search and other AI-powered features.
 */
export async function POST(req: Request) {
  try {
    // Parse request body with error handling for malformed JSON
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const { documentId, batchSize = 64 } = body; // Default to 64 chunks per batch

    // Determine which documents to process:
    // - If documentId provided: process only that document
    // - Otherwise: process all documents with 'embedding' status
    let targets: DocumentRecord[] = [];
    if (documentId) {
      const one = await store.get(documentId);
      if (one) targets = [one];
    } else {
      const all = await store.list();
      targets = all.filter((d) => d.processingStatus === "embedding");
    }

    if (!targets.length) {
      return NextResponse.json(
        {
          message:
            'No documents to embed (pass documentId or ensure status === "embedding")',
        },
        { status: 200 }
      );
    }

    // Return early if no documents found to process
    if (!targets.length) {
      return NextResponse.json(
        {
          message:
            'No documents to embed (pass documentId or ensure status === "embedding")',
        },
        { status: 200 } // HTTP 200 since this is not an error condition
      );
    }

    // Initialize Pinecone index connection
    const { index } = getPinecone();

    // Track processing results
    const processed: Array<{ id: string; chunks: number }> = []; // Successfully processed docs
    const failures: Array<{ id: string; reason: string }> = []; // Failed documents with reasons

    // Process each document sequentially
    for (const doc of targets) {
      try {
        // Validate document has extractable content
        if (!doc.extractedContent?.trim()) {
          throw new Error("Document has no extractedContent");
        }

        // 1) CHUNKING PHASE: Split content into manageable pieces
        // - 1000 tokens target per chunk (~4000 characters)
        // - 100 token overlap between chunks maintains context continuity
        const chunks = chunkText(doc.extractedContent, 1000, 100);
        if (!chunks.length) {
          throw new Error("No chunks produced");
        }

        // 2) EMBEDDING PHASE: Convert text chunks to vector embeddings
        const vectors: Array<{
          id: string; // Unique identifier for this vector
          values: number[]; // The actual embedding vector (1536 dimensions for text-embedding-3-small)
          metadata: Record<string, any>; // Contextual information for retrieval
        }> = [];

        // Process chunks in batches to optimize API calls and avoid rate limiting
        for (let i = 0; i < chunks.length; i += batchSize) {
          // Get next batch of chunks
          const batch = chunks.slice(i, i + batchSize);

          // Extract just the text content for embedding
          const input = batch.map((b) => b.content);

          // Call OpenAI Embeddings API to convert text to vectors
          const resp = await openai.embeddings.create({
            model: "text-embedding-3-small", // Cost-effective embedding model
            input, // Array of text strings to embed
          });

          // Map embeddings response to vector objects with metadata
          resp.data.forEach((e, j) => {
            const chunk = batch[j];
            vectors.push({
              // Create unique ID combining document ID and chunk index
              id: `${doc.id}-${chunk.chunkIndex}`,
              values: e.embedding, // The numerical vector representation
              metadata: {
                documentId: doc.id, // Reference back to source document
                filename: doc.filename, // Original filename
                fileType: doc.fileType, // PDF, DOCX, etc.
                uploadDate: doc.uploadDate, // When document was uploaded
                chunkIndex: chunk.chunkIndex, // Position in original document
                content: chunk.content, // Original text for display/highlighting
              },
            });
          });
        }

        // 3) STORAGE PHASE: Save vectors to Pinecone vector database
        // Pinecone automatically handles vector indexing for efficient similarity search
        await index.upsert(vectors);

        // 4) UPDATE PHASE: Mark document as successfully processed
        store.update(doc.id, {
          chunkCount: chunks.length, // Record how many chunks were created
          processingStatus: "completed", // Update status to completed
        });

        // Record successful processing
        processed.push({ id: doc.id, chunks: chunks.length });
      } catch (e: any) {
        // Handle any errors during document processing
        const reason = e?.message || "Embedding/indexing failed";

        // Update document status to error
        store.update(doc.id, {
          processingStatus: "error",
          errorMessage: reason,
        });

        // Record failure for response
        failures.push({ id: doc.id, reason });
      }
    }

    // Return processing results
    return NextResponse.json({ processed, failures }, { status: 200 });
  } catch (e: any) {
    // Handle any unexpected errors in the API route
    return NextResponse.json(
      { error: e?.message || "Embedding route error" },
      { status: 500 } // Internal server error
    );
  }
}
