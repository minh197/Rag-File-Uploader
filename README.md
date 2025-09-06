# 📄 Document RAG System

# Live Demo: https://rag-file-uploader-c7djxdhrj-lees-projects-dd8d5cb9.vercel.app/

> Transform your scattered documents into an intelligent, searchable knowledge base with AI-powered chat and source citations.

## 🎯 What it Does

A web application that allows users to upload documents (PDF, images, CSV, DOCX, TXT), extracts and processes the content, creates embeddings, stores them in a vector database, and provides an interactive chat interface for querying documents with **source-grounded citations**.

## ✨ Key Features

- 🚀 **Auto-Processing Pipeline** — Documents automatically progress from upload → extraction → embedding → completion
- 🔄 **Real-time Status Tracking** — Color-coded badges show processing status with live updates
- 💬 **AI Chat Interface** — Interactive Q&A with streaming responses and source citations
- 🔍 **Hybrid Search** — Combines semantic similarity with keyword matching
- 📱 **Responsive Design** — Works seamlessly on desktop and mobile devices
- ⚡ **Performance Optimized** — Efficient polling, memory leak prevention, and API optimization

## ✨ Why it Matters

- **🗂️ Centralize Knowledge** — Turn unstructured docs into a searchable knowledge base
- **🔍 Reliable Answers** — Every response includes citations for full traceability
- **🚀 Simple Deployment** — Runs as a Next.js app, easily deployable on Vercel

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd document-rag-system

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Add your OpenAI and Pinecone API keys

# 4. Run the development server
npm run dev

# 5. Open http://localhost:3000 and start uploading documents!
```

### Environment Variables

```env
OPENAI_API_KEY=sk-your-openai-key-here
PINECONE_API_KEY=your-pinecone-key-here
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX_NAME=document-rag-index
```

## 🏗️ Architecture Overview

### Core Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes (Serverless)
- **Vector Database:** Pinecone
- **AI/ML:** OpenAI Embeddings + LangChain.js
- **UI Components:** shadcn/ui

### Document Processing Pipeline

```
📁 Upload → 🟡 Extracting → 🟣 Embedding → 🟢 Completed → 💬 Ready for Chat
    ↓           ↓              ↓              ↓              ↓
Auto-embed  Auto-embed    Auto-embed    Status badges   AI Chat
```

**Status Flow:**

- 🟡 **Extracting** — Text extraction in progress
- 🟣 **Embedding** — Creating vector embeddings
- 🟢 **Completed** — Ready for search and chat
- 🔴 **Error** — Processing failed with error details

**Chat Flow:**

```
[User Question] → [Hybrid Search] → [Retrieve Context] → [Generate Answer] → [Return with Citations]
```

## 🔧 Core Design Decisions

### 1. **Framework & Runtime**

- **Next.js 14** with App Router for unified frontend + serverless APIs
- **TypeScript** for type safety and maintainability
- **Serverless deployment** for cost efficiency and scalability

### 2. **Document Processing**

| Format     | Library        | Method                     |
| ---------- | -------------- | -------------------------- |
| **PDF**    | `pdf-parse`    | Robust text extraction     |
| **Images** | `tesseract.js` | OCR with CDN worker paths  |
| **CSV**    | `papaparse`    | Schema detection + parsing |
| **DOCX**   | `mammoth`      | Clean text extraction      |
| **TXT**    | Native         | Direct file reading        |
| **SVG**    | XML parser     | Text extraction from XML   |

### 3. **Chunking & Embeddings**

- **Chunk Size:** ~1000 tokens with 100-token overlap
- **Model:** OpenAI `text-embedding-3-small` (fast, cost-effective)
- **Storage:** Pinecone with rich metadata (filename, type, chunk index)

### 4. **Retrieval & Chat (RAG)**

- **Hybrid Search:** Combines semantic similarity + keyword matching
- **Context Ranking:** Top-k relevant chunks with reranking
- **Streaming Responses:** Real-time answer generation
- **Source Citations:** Every answer includes document references

### 5. **UI/UX Features**

- 🎯 **Upload:** Drag-and-drop with progress tracking and auto-processing
- 📋 **Management:** Document list with real-time status badges, content preview, deletion
- 💬 **Chat:** Interactive chat interface with streaming responses and source citations
- 🔄 **Real-time Updates:** Automatic polling during processing with memory leak prevention
- 🎨 **Design:** Clean, responsive interface with Tailwind CSS and status indicators

### 6. **Privacy & Performance**

- 🔐 API keys stored securely in environment variables
- ⚡ Optimized payloads to minimize API costs
- 🗑️ Clear data deletion and local file preview

## 📊 Information Flow

```
[User Upload] → [Validate & Extract] → [Chunk Text] → [Create Embeddings] → [Store in Pinecone]
                                                                                      ↓
[Chat Interface] ← [Generate Response] ← [Build Context] ← [Hybrid Search] ← [User Question]
```

## 🛠️ API Endpoints

| Endpoint                | Method     | Purpose                               |
| ----------------------- | ---------- | ------------------------------------- |
| `/api/upload`           | POST       | Upload and process files (auto-embed) |
| `/api/documents`        | GET        | List all documents with status        |
| `/api/documents/[id]`   | GET/DELETE | Document operations                   |
| `/api/embedding/create` | POST       | Create embeddings (auto-triggered)    |
| `/api/chat`             | POST       | Send chat messages with streaming     |
| `/api/search`           | POST       | Search through documents              |
| `/api/health`           | GET        | System health check                   |

## 🎮 Try It Out

**Sample Use Cases:**

- 📚 Upload research papers → Ask about methodology
- 📊 Upload CSV datasets → Query for trends and insights
- 📝 Upload meeting notes → Search for action items
- 📄 Upload manuals → Get step-by-step instructions
- 🖼️ Upload images with text → OCR extraction and search

## 🚀 Recent Updates

### Auto-Processing Pipeline

- **Auto-Embedding**: Documents automatically progress from upload → extraction → embedding → completion
- **Real-time Status**: Color-coded badges show processing status with live updates
- **Memory Optimization**: Fixed polling memory leaks and API spam issues

### Enhanced File Support

- **Image OCR**: Full support for PNG, JPEG images with tesseract.js
- **Robust Processing**: Handles PDF, DOCX, CSV, TXT, SVG files reliably
- **Error Handling**: Graceful failure handling with clear error messages

### Performance Improvements

- **Efficient Polling**: Optimized real-time updates without memory leaks
- **API Optimization**: Reduced unnecessary API calls and improved response times
- **Streaming Chat**: Real-time chat responses with source citations

---
