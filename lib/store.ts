import { DocumentRecord } from "./types";

const docs = new Map<string, DocumentRecord>();

export const store = {
  create(doc: DocumentRecord) {
    docs.set(doc.id, doc);
    return doc;
  },
  get(id: string) {
    return docs.get(id) || null;
  },
  list() {
    return Array.from(docs.values());
  },
  update(id: string, patch: Partial<DocumentRecord>) {
    const cur = docs.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    docs.set(id, next);
    return next;
  },
  delete(id: string) {
    return docs.delete(id);
  },
  clear() {
    docs.clear();
  },
};
