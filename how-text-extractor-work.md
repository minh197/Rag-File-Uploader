We read the raw file bytes into memory.

We detect the file type (PDF/Docx/CSV/Image/TXT/SVG).

We run the right extractor for that type to pull out plain text.

We save that text as extractedContent and advance status to embedding (next step).

What happens under the hood

1. File → bytes

Browser sends the file to POST /api/upload as multipart/form-data.

Server converts it to a Node Buffer (a byte array).
That way every extractor can work on the same input shape.

2. Decide “how to read it”

We look at MIME and extension (e.g., application/pdf, .docx, .csv, image/jpeg).

That maps to one of our extractors: pdf | docx | csv | image | txt | svg.

3. Run the extractor (per format)
   PDF (text-based PDFs)

Many PDFs already contain a text layer (you can select/copy in a PDF reader).

We use a parser to read that layer and concatenate the text in reading order.

When it fails/looks empty: the PDF is likely scanned (no text layer). For those, you need OCR on each page image (we can add this later).

DOCX (Word)

A .docx is a ZIP of XML files.

The library opens the archive and reads the document XML, stripping out layout and keeping just the paragraph text (and some basic structure like line breaks).

CSV

CSV is just rows of text separated by commas/newlines.

We parse rows safely (respecting quotes/escaped commas) and turn them into clean lines like:

name, policy, rate
pto, accrual, 1.5

Good for both human reading and later search.

TXT

Already text. We just normalize whitespace and store it.

SVG

It’s XML. We strip tags and keep the text nodes (the words inside <text>…</text>).

Images (PNG/JPG) — OCR

Images are pixels, no letters—so we use OCR (Optical Character Recognition) to “see” the text.

At a high level, the OCR engine (Tesseract) does:

Preprocess: clean the image (binarize/deskew) to make text stand out.

Segment: find text lines, then words, then character shapes.

Recognize: classify each character shape (learned model).

Word assembly: join characters into words; use a language model/dictionary to fix likely mistakes.

Output: plain text.

We load Tesseract’s worker + WASM from a CDN so it runs reliably in Next.js.

4. Normalize & store

No matter the source, we end up with:

{ text: string, meta: { kind, extractedAt, pages? } }

We save text to the document record as extractedContent and set processingStatus → embedding (meaning “ready for the next step”).
