"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Doc = {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  processingStatus:
    | "uploading"
    | "extracting"
    | "embedding"
    | "completed"
    | "error";
  uploadDate: string;
  chunkCount?: number;
};

// Status badge component with colors
function StatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "uploading":
        return "bg-blue-100 text-blue-800";
      case "extracting":
        return "bg-yellow-100 text-yellow-800";
      case "embedding":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTooltip = (status: string) => {
    if (status === "embedding") {
      return "Embedding pending (enable Step 5 to complete)";
    }
    return null;
  };

  const tooltip = getTooltip(status);

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
        status
      )} ${tooltip ? "cursor-help" : ""}`}
      title={tooltip || undefined}
    >
      {status}
    </span>
  );
}

export default function DocumentsList() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);

  // Prevent overlapping fetches
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) {
      console.log("🚫 Load blocked - request already in flight");
      return;
    }

    console.log("🔄 Starting API call to /api/documents");
    inflight.current = true;
    try {
      setLoading(true);
      const res = await fetch("/api/documents", { cache: "no-store" });
      const data = await res.json();
      console.log(
        "✅ API response received:",
        data.documents?.length,
        "documents"
      );
      setDocs(data.documents || []);
    } catch (error) {
      console.error("❌ API call failed:", error);
    } finally {
      setLoading(false);
      inflight.current = false;
      console.log("🏁 API call completed, inflight reset");
    }
  }, []);

  // Derive whether we should poll (omit "embedding" until Step 5 is implemented)
  const shouldPoll = useMemo(() => {
    const processingDocs = docs.filter((d) => {
      if (
        d.processingStatus !== "uploading" &&
        d.processingStatus !== "extracting"
      ) {
        return false;
      }

      // Stop polling if stuck for more than 2 minutes
      const uploadTime = new Date(d.uploadDate).getTime();
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

      if (uploadTime < twoMinutesAgo) {
        console.warn(
          "⚠️ Document stuck in processing, stopping poll:",
          d.filename
        );
        return false;
      }

      return true;
    });

    console.log("🤔 shouldPoll calculation:");
    console.log("  - Total docs:", docs.length);
    console.log("  - Processing docs:", processingDocs.length);
    console.log(
      "  - Processing statuses:",
      processingDocs.map((d) => d.processingStatus)
    );
    console.log("  - Should poll?", processingDocs.length > 0);

    return processingDocs.length > 0;
  }, [docs]);

  // Initial load once
  useEffect(() => {
    console.log("🎯 Initial load effect triggered");
    load();
  }, [load]);

  // Start/stop ONE interval based on shouldPoll
  useEffect(() => {
    console.log("⏰ Polling effect triggered - shouldPoll:", shouldPoll);

    if (!shouldPoll) {
      console.log("⏹️ No polling needed - no processing documents");
      return;
    }

    console.log("▶️ Starting polling interval (every 2 seconds)");
    const id = window.setInterval(() => {
      console.log("⚡ Polling interval fired");
      load();
    }, 2000);

    return () => {
      console.log("🛑 Clearing polling interval");
      window.clearInterval(id);
    };
  }, [shouldPoll, load]);

  // Listen for a custom event to reload after upload without reloading the page
  useEffect(() => {
    console.log("📡 Setting up docs:reload event listener");
    const handler = () => {
      console.log("📨 docs:reload event received");
      load();
    };
    document.addEventListener("docs:reload", handler);
    return () => {
      console.log("🔌 Removing docs:reload event listener");
      document.removeEventListener("docs:reload", handler);
    };
  }, [load]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Documents</h2>
        <button onClick={load} className="px-2 py-1 text-sm border rounded">
          Refresh
        </button>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
        {/* Debug info */}
        <span className="text-xs text-gray-400">
          (Polling: {shouldPoll ? "ON" : "OFF"})
        </span>
      </div>
      <ul className="divide-y border rounded">
        {docs.length === 0 && (
          <li className="p-3 text-gray-500">No documents yet.</li>
        )}
        {docs.map((d) => (
          <li key={d.id} className="p-3 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-medium">{d.filename}</div>
                <StatusBadge status={d.processingStatus} />
              </div>
              <div className="text-xs text-gray-500">
                {d.fileType} · {(d.fileSize / 1024).toFixed(1)} KB ·{" "}
                {new Date(d.uploadDate).toLocaleString()}
              </div>
            </div>
            <code className="text-xs text-gray-400">{d.id}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
