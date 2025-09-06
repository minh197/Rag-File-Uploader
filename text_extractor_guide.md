# How Text Extractors Work: A Beginner's Guide

## Overview

A text extractor is like a universal translator that can read different file types and convert them into plain text that computers can easily work with. Think of it as taking a book, magazine, spreadsheet, or photo with text and converting everything into simple, readable text.

## The 4-Step Process

### Step 1: Read the File
- What happens: We read the raw file bytes into memory
- Think of it like: Opening a sealed envelope to see what's inside
- Technical detail: The file gets converted into a format our computer can work with (called a "byte array")

### Step 2: Identify the File Type  
- What happens: We detect what kind of file it is (PDF, Word document, spreadsheet, image, etc.)
- Think of it like: Looking at a book's cover to know if it's a novel, textbook, or magazine
- How we do it: We check the file extension (`.pdf`, `.docx`) and MIME type (`application/pdf`)

### Step 3: Extract the Text
- What happens: We use the right "extractor tool" for each file type
- Think of it like: Using different tools for different jobs (screwdriver for screws, hammer for nails)
- Result: Plain text that we can search, analyze, or process further

### Step 4: Save and Continue
- What happens: We save the extracted text and mark the file as "ready for next step"
- Think of it like: Filing the translated document in the right folder

---

## Behind the Scenes: Technical Details

### Step 1: File → Bytes
What your browser does:
- Sends the file to our server using a special format called `multipart/form-data`
- Server converts it to a Node Buffer (basically a list of numbers representing the file)

Why this matters: Every extractor can now work with the same input format, regardless of the original file type.

### Step 2: File Type Detection
How we identify files:
- Look at MIME type (like `application/pdf` or `image/jpeg`)
- Check file extension (`.pdf`, `.docx`, `.csv`, `.jpg`)
- Map to the right extractor: `pdf | docx | csv | image | txt | svg`

### Step 3: Format-Specific Extraction

#### PDF Files
For text-based PDFs:
- Most PDFs contain a hidden "text layer" (that's why you can copy/paste from them)
- We read this layer and organize the text in reading order
- When it fails: The PDF is probably scanned (like a photo of a document)
- Solution: Use OCR (Optical Character Recognition) to "read" the image

#### DOCX Files (Microsoft Word)
What a DOCX really is:
- A ZIP file containing XML documents (surprised?)
- We unzip it and read the main document XML
- Strip out formatting, keep the actual text content
- Preserve basic structure like paragraphs and line breaks

#### CSV Files (Spreadsheets)
Simple but tricky:
- Rows of text separated by commas
- Challenge: Handle quotes and escaped commas properly
- Example output:
  ```
  name, policy, rate
  pto, accrual, 1.5
  vacation, fixed, 20
  ```
- Why it's useful: Easy for both humans to read and computers to search

#### TXT Files
The easiest case:
- Already plain text!
- We just clean up whitespace and store it

#### SVG Files
Scalable Vector Graphics:
- XML-based format for graphics
- Contains `<text>` elements with actual text
- We extract text from these elements, ignore the graphics

#### Images (PNG/JPG) — OCR Magic
The challenge: Images are just colored pixels, not text

How OCR (Tesseract) works:
1. Preprocess: Clean up the image
   - Make text black and background white
   - Straighten tilted text
   - Remove noise and artifacts

2. Segment: Find the text parts
   - Locate text lines
   - Identify individual words
   - Isolate character shapes

3. Recognize: Identify each character
   - Use machine learning models trained on millions of examples
   - Compare shapes to known letters/numbers

4. Word Assembly: Make sense of it all
   - Join characters into words
   - Use dictionaries to fix likely mistakes
   - Apply language rules to improve accuracy

Technical note: We use Tesseract's WebAssembly version loaded from a CDN for reliable performance in web browsers.

### Step 4: Normalize & Store
No matter the source, we end up with:
```javascript
{
  text: "The extracted plain text content...",
  meta: {
    kind: "pdf" | "docx" | "csv" | "image" | "txt" | "svg",
    extractedAt: "2024-03-15T10:30:00Z",
    pages: 5 // for multi-page documents
  }
}
```

Final steps:
- Save the text as `extractedContent` in our database
- Update `processingStatus` to `embedding` (ready for the next processing step)

---

## Common Questions

Q: What if extraction fails?
A: We have fallback methods and error handling for each file type.

Q: How accurate is OCR?
A: Modern OCR is quite good (95%+ accuracy) for clear, well-lit text. Handwriting and poor quality images are more challenging.

Q: What about password-protected files?
A: Currently, we require files to be unlocked before upload. We may add password support in the future.

Q: Can you extract from scanned PDFs?
A: Yes! When we detect a PDF has no text layer, we can fall back to OCR processing.

---

## Next Steps

After text extraction, the content typically goes through:
1. Embedding generation (converting text to numerical vectors)
2. Indexing (making it searchable)
3. Storage (saving for quick retrieval)