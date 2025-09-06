// components/SearchBox.tsx
"use client";
import { useState } from "react";

// Escapes regex special chars in the query terms
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Renders text with <mark> around any query terms (case-insensitive)
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!text || !query) return <>{text}</>;

  // split query into up to 5 terms, ignore blanks
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);

  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");

  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const match = terms.includes(part.toLowerCase());
        return match ? (
          <mark key={i} className="bg-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, k: 5 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Search failed");
      setRes(data.results || []);
    } catch (e: any) {
      setErr(e?.message || "Search failed");
      setRes([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="border p-2 rounded w-full"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your documents…"
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <button onClick={run} className="border px-3 rounded">
          {busy ? "Searching…" : "Search"}
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <ul className="space-y-2">
        {res.map((m, i) => (
          <li key={i} className="border rounded p-3">
            <div className="text-sm text-gray-600">
              {m.filename} • score {m.score?.toFixed?.(3)}
            </div>
            <div className="mt-1 text-sm whitespace-pre-line">
              {" "}
              <HighlightedText text={m.snippet || m.chunkContent} query={q} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
