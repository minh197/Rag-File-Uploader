"use client";

import { useEffect, useState } from "react";

type Doc = {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  processingStatus: string;
  uploadDate: string;
  chunkCount?: number;
};

export default function DocumentsList() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      const data = await res.json();
      setDocs(data.documents || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Documents</h2>
        <button onClick={load} className="px-2 py-1 text-sm border rounded">
          Refresh
        </button>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
      </div>
      <ul className="divide-y border rounded">
        {docs.length === 0 && (
          <li className="p-3 text-gray-500">No documents yet.</li>
        )}
        {docs.map((d) => (
          <li key={d.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{d.filename}</div>
              <div className="text-xs text-gray-500">
                {d.fileType} · {(d.fileSize / 1024).toFixed(1)} KB ·{" "}
                {d.processingStatus} · {new Date(d.uploadDate).toLocaleString()}
              </div>
            </div>
            <code className="text-xs">{d.id}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
