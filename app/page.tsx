"use client";
import UploadDropzone from "../components/UploadDropZone";
import DocumentsList from "../components/DocumentsList";
import SearchBox from "../components/SearchBox";
import ChatBox from "../components/ChatBox";

/**
 *This page mixes a client-side uploader (mutates data) and a server-rendered list (reads data).
By default, Next.js might cache this route or its data. Adding `export const dynamic = 'force-dynamic'`
forces server-side rendering on *every request* and skips route/data caches, so a hard reload or
navigating back to this page always shows the newest documents.
When you’re ready to be more precise (usually better for perf):
   1) Use `router.refresh()` in the upload success callback so the list re-fetches just-in-time.
   2) Or use cache tags: `fetch(..., { next: { tags: ['documents'] } })` in DocumentsList,
  and call `revalidateTag('documents')` in your upload API after creating files.
   3) Or use `fetch(..., { cache: 'no-store' })` only where freshness is required.

Keep `force-dynamic` if you want a simple, always-fresh page during development,
but prefer the targeted strategies above for production to avoid unnecessary re-renders.
 */
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Document RAG System</h1>
      <SearchBox />
      <ChatBox />
      <UploadDropzone
        onUploaded={() => document.dispatchEvent(new Event("docs:reload"))}
      />
      <DocumentsList />
    </main>
  );
}
