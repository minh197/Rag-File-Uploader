Document RAG System — Overview

What it is:
A web app where users upload documents (PDF, images, CSV, DOCX, TXT). We extract text, chunk it, embed with OpenAI, store vectors in Pinecone, and power an interactive chat that answers questions with source-grounded citations.

Why it matters:

Centralize unstructured docs into a searchable knowledge base

Reliable answers with citations (traceability)

Runs as a simple Next.js app (easy to deploy on Vercel)

Core Design Decisions

1. Framework & Runtime

Next.js 14 (App Router) for unified frontend + serverless APIs

Serverless API Routes for upload, extraction, search, chat

TypeScript for correctness and maintainability

2. Document Processing

PDF: pdf-parse (node) for robust text extraction

Images (PNG/JPEG/SVG): tesseract.js OCR (fallback path)

CSV: papaparse with basic schema sniffing

DOCX: mammoth for clean text

TXT: direct read

Output is normalized JSON with metadata (filename, type, content, extraction_date)

3. Chunking & Embeddings

Chunking: ~1000 tokens, 100-token overlap to preserve context across boundaries

Embedding Model: OpenAI text-embedding-3-small (fast, inexpensive, good semantic recall)

Vector DB: Pinecone (metadata filters, scalable similarity search)

Store: documentId, filename, fileType, chunkIndex, content, uploadDate

4. Retrieval & Chat (RAG)

Hybrid search (semantic + keyword) to catch exact terms and concepts

Rerank + top-k context into the model prompt

Streaming responses with source citations (chunk excerpt + score)

Built with LangChain.js to simplify the retrieval pipeline

5. UI/UX

Upload experience: drag-and-drop, type/size validation, progress bars, thumbnails

Document management: list, inspect extracted text, delete, filter

Chat: history, live streaming, document context chips, citations

Tailwind + shadcn/ui for fast, consistent UI

6. Privacy & Cost

API keys in env files; no secrets on client

Minimal payloads to OpenAI (chunked context, not entire docs)

Local preview and clear delete operations

End-to-End Information Flow
[User]
│
│ Drag & drop files
▼
[Upload UI] ──► POST /api/upload
│ │
│ ├─ Validate (type, size)
│ ├─ Extract content (pdf-parse, tesseract, papaparse, mammoth, txt)
│ └─ Normalize → JSON { content, metadata }
▼
[Processing Status UI] <─ GET /api/processing/status/:id
│
├─▶ POST /api/embedding/create
│ ├─ Chunk text (1000 tokens, 100 overlap)
│ ├─ OpenAI embeddings (text-embedding-3-small)
│ └─ Upsert to Pinecone (vectors + metadata)
│
▼
[Documents List / Viewer] <─ GET /api/documents & /api/documents/:id
│
│ User asks a question
▼
[Chat UI] ──► POST /api/chat
├─ Hybrid search (semantic Pinecone + keyword filter)
├─ Rerank & select top-k chunks
├─ Build RAG prompt (with citations & metadata)
└─ Stream answer back to client
▼
[Assistant Response + Source Chips]

Minimal Architecture Diagram (Logical)
┌──────────────────────────┐
│ Next.js UI │ (App Router + Tailwind + shadcn/ui)
│ Upload | Docs | Chat │
└───────────┬──────────────┘
│
▼
┌──────────────────────────┐
│ Next.js API Routes │ (/api/upload, /api/documents, /api/chat, /api/search)
│ - Validation │
│ - Extraction │
│ - Embedding pipeline │
│ - Retrieval + RAG │
└───────────┬──────────────┘
│
┌──────┴───────┐
▼ ▼
┌────────────┐ ┌───────────────┐
│ OpenAI API │ │ Pinecone │
│ Embeddings │ │ Vector Index │
└────────────┘ └───────────────┘

## Quick Start

1. Clone the repo
2. `npm install`
3. Set up `.env.local` with your OpenAI/Pinecone keys
4. `npm run dev`
5. Upload a document and start chatting!
