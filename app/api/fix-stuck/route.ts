import { NextResponse } from "next/server";
import { store } from "../../../lib/store";

export async function POST() {
  try {
    const docs = store.list();
    const stuckDocs = docs.filter(doc => 
      doc.processingStatus === "extracting" && 
      new Date(doc.uploadDate).getTime() < Date.now() - (2 * 60 * 1000) // 2 minutes ago
    );

    if (stuckDocs.length === 0) {
      return NextResponse.json({ message: "No stuck documents found" });
    }

    // Fix all stuck documents
    const fixed = [];
    for (const doc of stuckDocs) {
      const updated = store.update(doc.id, {
        processingStatus: "error",
        errorMessage: "Manual intervention - processing was stuck"
      });
      if (updated) {
        fixed.push(updated);
      }
    }

    return NextResponse.json({ 
      message: `Fixed ${fixed.length} stuck documents`,
      fixed: fixed.map(d => ({ id: d.id, filename: d.filename }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fix stuck documents" },
      { status: 500 }
    );
  }
}
