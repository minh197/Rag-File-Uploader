import { randomUUID } from "crypto";

/** Generate a stable, prefixed document id (e.g., doc_1234...) */
export const newDocId = () => `doc_${randomUUID()}`;
