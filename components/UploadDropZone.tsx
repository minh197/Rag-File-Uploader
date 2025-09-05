"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

type Props = { onUploaded?: () => void };

export default function UploadDropzone({ onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setBusy(true);
      setMsg(null);
      try {
        const fd = new FormData();
        for (const f of acceptedFiles) fd.append("files", f);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setMsg(data.error || "Upload failed");
        } else {
          const count = data.created?.length ?? 0;
          setMsg(
            `Uploaded ${count} file(s)` +
              (data.errors?.length ? `, ${data.errors.length} failed` : "")
          );
          onUploaded?.();
        }
      } catch (e: any) {
        setMsg(e?.message || "Upload error");
      } finally {
        setBusy(false);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 10 * 1024 * 1024,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".svg"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${
          isDragActive ? "bg-gray-100" : "bg-white"
        } ${busy ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        <p className="font-medium">
          Drag & drop files here, or click to select
        </p>
        <p className="text-sm text-gray-500">
          PDF, PNG, JPEG, SVG, TXT, CSV, DOCX · ≤ 10MB each
        </p>
      </div>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
