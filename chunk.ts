// lib/chunk.ts

// Define what a text chunk looks like
export type TextChunk = {
  chunkIndex: number; // Which chunk this is (0, 1, 2, ...)
  content: string; // The actual text content of this chunk
};

// Approximate number of characters per token (used by AI models)
// AI models process text in "tokens" rather than characters
const APPROX_CHARS_PER_TOKEN = 4;

// Estimate how many tokens are in a string based on character count
function estTokens(s: string) {
  return Math.ceil(s.length / APPROX_CHARS_PER_TOKEN);
}

/**
 * Splits a long text into smaller chunks with overlap between them
 *
 * Why chunking is needed:
 * - AI models have limited "context windows" (can only process so much text at once)
 * - Overlap ensures context isn't lost between chunks
 * - Breaking at natural boundaries (paragraphs, sentences) preserves meaning
 *
 * @param text - The complete text to split into chunks
 * @param maxTokens - Maximum tokens per chunk (default: ~4,000 characters)
 * @param overlapTokens - How many tokens should overlap between chunks (default: ~400 characters)
 * @returns Array of text chunks with metadata
 */
export function chunkText(
  text: string,
  maxTokens = 1000,
  overlapTokens = 100
): TextChunk[] {
  // Handle edge cases: empty or missing text
  if (!text?.trim()) return [];

  // Convert token limits to character limits for easier processing
  const maxChars = maxTokens * APPROX_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * APPROX_CHARS_PER_TOKEN;

  // Clean up the text:
  // 1. Remove carriage returns (Windows line endings → Unix line endings)
  // 2. Clean up spaces/tabs before newlines
  // 3. Trim whitespace from start and end
  const clean = text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  // Array to store our resulting chunks
  const chunks: TextChunk[] = [];

  // Track our position in the text and assign chunk numbers
  let start = 0; // Where we're starting the current chunk
  let idx = 0; // Current chunk index number

  // Process the text until we've covered all of it
  while (start < clean.length) {
    // Calculate where this chunk should end (without considering boundaries)
    let end = Math.min(start + maxChars, clean.length);

    // Look at the potential chunk and find the best place to end it
    const slice = clean.slice(start, end);

    // Try to find good breaking points in order of preference:

    // 1. First preference: break at paragraph boundary (double newline)
    let cut = slice.lastIndexOf("\n\n");

    // 2. If no good paragraph break or it's too early in the chunk,
    //    try to break at a sentence boundary (period followed by space)
    if (cut < end * 0.6) cut = slice.lastIndexOf(". ");

    // 3. If no good sentence break, try to break at least at a word boundary (space)
    if (cut < end * 0.6) cut = slice.lastIndexOf(" ");

    // 4. If no good breaking point found at all, just use the full slice length
    if (cut <= 0) cut = slice.length;

    // Extract the actual chunk content and clean it up
    const piece = slice.slice(0, cut).trim();

    // Only add non-empty chunks to our results
    if (piece) chunks.push({ chunkIndex: idx++, content: piece });

    // Check if we've reached the end of the text
    if (end >= clean.length) break;

    // Calculate where the next chunk should start
    // We subtract the overlap to create continuity between chunks
    const nextStart = start + piece.length;
    start = Math.max(0, nextStart - overlapChars);
  }

  // Return all the chunks we created
  return chunks;
}
