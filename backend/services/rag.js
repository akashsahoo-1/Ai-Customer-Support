/**
 * rag.js — Hybrid keyword-retrieval RAG pipeline.
 *
 * UPLOAD  : two-stage PDF extraction
 *   Stage 1 — pdf-parse  (fast, works on text-layer PDFs)
 *   Stage 2 — pdfjs-dist renders pages → canvas PNG → Tesseract OCR
 *             (fallback for scanned / image-only PDFs)
 * QUESTION: intent detection → if general chat → AI directly
 *           else → keyword scoring → top paragraphs → AI
 *           if no PDF chunks found → fallback to general AI (never "Not found" spam)
 * SUMMARY : first SUMMARY_CHUNKS chunks → bullet-point AI prompt
 * FOLLOW-UPS: extract headings from answer (zero AI tokens)
 *
 * Exported API matches the original vector version exactly → no route/UI changes.
 */

'use strict'

// ── Browser-global polyfills required by pdf-parse v2 (bundles pdfjs internally) ──
// pdf-parse v2 expects DOMMatrix / DOMRect / DOMPoint to exist in the global scope.
// Node.js 21 does not ship these, so we polyfill minimally before any require().
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0 }
    static fromMatrix(m) { return new DOMMatrix() }
  }
}
if (typeof globalThis.DOMRect === 'undefined') {
  globalThis.DOMRect = class DOMRect {
    constructor(x=0,y=0,w=0,h=0){this.x=x;this.y=y;this.width=w;this.height=h}
  }
}
if (typeof globalThis.DOMPoint === 'undefined') {
  globalThis.DOMPoint = class DOMPoint {
    constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w}
  }
}

const Groq = require('groq-sdk')
const { query } = require('../config/db')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Configuration ─────────────────────────────────────────────────────────────

const CHUNK_SIZE = 700          // chars per stored chunk (readable, scored individually)
const TOP_K = 5                 // top chunks to return for a QA question
const SUMMARY_CHUNKS = 3        // number of first chunks used for summary

// Common English words to ignore during keyword extraction
const STOP_WORDS = new Set([
  'what', 'is', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'how', 'why', 'when', 'where', 'who', 'are', 'was', 'were', 'has', 'have',
  'had', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'be',
  'been', 'being', 'i', 'my', 'your', 'their', 'its', 'this', 'that', 'these',
  'those', 'me', 'him', 'her', 'us', 'them', 'and', 'or', 'but', 'so', 'if',
  'then', 'also', 'just', 'about', 'tell', 'give', 'explain', 'describe',
  'please', 'get', 'any', 'some', 'all', 'more', 'much', 'many', 'very',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract meaningful keywords from a user question. */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

/** Escape a string for safe use in RegExp. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Detect whether the question is asking for a summary. */
function isSummaryQuestion(question) {
  return /\b(summary|summarize|summarise|overview|recap|brief)\b/i.test(question)
}

/**
 * Detect whether the question is a general / conversational message that
 * should be handled by the AI directly without any PDF context.
 *
 * Triggers on:
 *  - Common greetings / small-talk phrases
 *  - Very short messages (< 5 chars after trimming)
 */
function isGeneralChat(question) {
  const q = question.toLowerCase().trim()
  // Short message — treat as casual
  if (q.length < 5) return true
  // Greeting / small-talk keywords
  const generalPhrases = [
    'hi', 'hello', 'hey', 'howdy', 'greetings', 'good morning', 'good afternoon',
    'good evening', 'good night', 'how are you', 'how r u', "what's up", 'whats up',
    'sup', 'yo', 'hiya', 'thanks', 'thank you', 'bye', 'goodbye', 'see you',
    'nice to meet', 'who are you', 'what are you', 'what can you do', 'help me',
  ]
  return generalPhrases.some(phrase => q.startsWith(phrase) || q === phrase)
}

// ── Text Extraction ───────────────────────────────────────────────────────────

/**
 * Stage-2 OCR: render each PDF page to a PNG via pdfjs-dist + canvas,
 * then run Tesseract on each image and concatenate the results.
 *
 * pdfjs-dist v5 is ESM-only — we load it via dynamic import() so it works
 * inside this CJS module without needing to convert the whole project to ESM.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Promise<string>}  OCR text (may be empty if rendering fails)
 */
async function ocrPdf(pdfBuffer) {
  // Dynamic import — pdfjs-dist v5 ships only ESM; require() won't work
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { createCanvas } = require('canvas')
  const Tesseract = require('tesseract.js')

  // Disable the Web Worker (Node environment has no Worker threads for this)
  GlobalWorkerOptions.workerSrc = ''

  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) })
  const pdfDoc = await loadingTask.promise
  const numPages = pdfDoc.numPages

  console.log(`[RAG] OCR: rendering ${numPages} page(s) for Tesseract…`)

  // Create one persistent Tesseract worker for all pages (reuse across pages = faster)
  const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} })

  const pageTexts = []

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 }) // 2× → better OCR accuracy

        const canvas = createCanvas(viewport.width, viewport.height)
        const ctx = canvas.getContext('2d')

        // Provide a NodeCanvasFactory so pdfjs-dist can create off-screen canvases
        const nodeCanvasFactory = {
          create(w, h) {
            const c = createCanvas(w, h)
            return { canvas: c, context: c.getContext('2d') }
          },
          reset(cf, w, h) { cf.canvas.width = w; cf.canvas.height = h },
          destroy() {},
        }

        await page.render({ canvasContext: ctx, viewport, canvasFactory: nodeCanvasFactory }).promise

        const pngBuffer = canvas.toBuffer('image/png')
        const { data: { text } } = await worker.recognize(pngBuffer)
        const clean = (text || '').trim()
        console.log(`[RAG] OCR page ${pageNum}/${numPages}: ${clean.length} chars`)
        if (clean.length > 0) pageTexts.push(clean)

      } catch (pageErr) {
        console.error(`[RAG] OCR error on page ${pageNum}:`, pageErr.message)
      }
    }
  } finally {
    await worker.terminate()
  }

  return pageTexts.join('\n\n')
}

/**
 * Extract readable text from an uploaded file.
 *
 * For PDFs:
 *   1. Try pdf-parse (instant — works for text-layer PDFs)
 *   2. If < 100 chars extracted → fall back to pdfjs-dist page rendering + Tesseract OCR
 *      (covers scanned / image-only PDFs)
 *
 * For TXT: straight UTF-8 decode.
 */
async function extractText(file) {
  try {
    if (file.mimetype === 'application/pdf') {

      // ── Stage 1: pdf-parse (fast path) ──────────────────────────────────
      let text = ''
      try {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(file.buffer)
        text = (data.text || '').trim()
        console.log(`[RAG] Stage 1 — pdf-parse: ${text.length} chars`)
      } catch (parseErr) {
        console.warn('[RAG] pdf-parse threw:', parseErr.message, '— will try OCR')
      }

      if (text.length >= 100) {
        console.log('[RAG] Stage 1 sufficient — skipping OCR')
        return text
      }

      // ── Stage 2: OCR fallback ────────────────────────────────────────────
      console.log(`[RAG] Stage 1 returned only ${text.length} chars — falling back to OCR`)
      const ocrText = await ocrPdf(file.buffer)
      console.log(`[RAG] Stage 2 — OCR total: ${ocrText.length} chars`)

      // Return whichever source gave more content
      const best = ocrText.length > text.length ? ocrText : text
      console.log(`[RAG] Using ${ocrText.length > text.length ? 'OCR' : 'pdf-parse'} result (${best.length} chars)`)
      return best
    }

    // Plain text file
    const text = file.buffer.toString('utf-8').trim()
    console.log(`[RAG] TXT extracted ${text.length} chars`)
    return text

  } catch (err) {
    console.error('[RAG] extractText error:', err.message)
    return ''
  }
}

// ── Text sanitization ─────────────────────────────────────────────────────────

/**
 * Strips non-printable / non-UTF-8 characters from extracted text.
 * This is a safety net — no binary data should ever reach the DB or the AI.
 */
function sanitizeText(text) {
  return text
    // Remove null bytes and control characters (keep \t \n \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove non-UTF-8 / binary artifact sequences
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]+/g, ' ')
    // Remove repeated punctuation / symbols that appear in garbled PDFs
    .replace(/([^\w\s]){3,}/g, ' ')
    // Collapse runs of spaces (preserve newlines)
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

// ── Chunking (700-char readable chunks) ──────────────────────────────────────

/**
 * Splits clean text into fixed-size chunks of ~CHUNK_SIZE characters.
 * Breaks on word boundaries so no word is cut in half.
 * Each chunk is independently scoreable and human-readable.
 */
function buildStorageChunks(text) {
  // Flatten to single-spaced lines (preserves paragraph breaks as spaces)
  const flat = text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 10)
    .join(' ')

  const chunks = []
  const words = flat.split(' ')
  let current = ''

  for (const word of words) {
    if (current.length + word.length + 1 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim())
      current = word
    } else {
      current += (current ? ' ' : '') + word
    }
  }
  if (current.trim().length > 10) chunks.push(current.trim())

  return chunks
}

// ── Process & Store Document ──────────────────────────────────────────────────

async function processDocument(docId, kbId, file) {
  try {
    console.log(`[RAG] Processing document ${docId} | type: ${file.mimetype}`)

    const rawText = await extractText(file)
    if (rawText.length === 0) {
      console.error(`[RAG] No text extracted for document ${docId} — PDF may be image-only or corrupt. Aborting.`)
      return
    }

    // Sanitize before storing — ensure no binary data enters the DB
    const fullText = sanitizeText(rawText)
    console.log(`[RAG] Extracted: ${rawText.length} chars | After sanitize: ${fullText.length} chars`)

    if (fullText.length < 50) {
      console.error(`[RAG] Sanitized text too short (${fullText.length} chars) — likely not readable text. Aborting.`)
      return
    }

    const chunks = buildStorageChunks(fullText)
    console.log(`[RAG] Storing ${chunks.length} chunks for document ${docId}`)

    let saved = 0
    for (const chunk of chunks) {
      try {
        // embedding column is nullable — intentionally omitted (no vectors needed)
        await query(
          `INSERT INTO chunks (document_id, knowledge_base_id, content)
           VALUES ($1, $2, $3)`,
          [docId, kbId, chunk]
        )
        saved++
      } catch (err) {
        console.error(`[RAG] DB error on chunk ${saved + 1}:`, err.message)
      }
    }

    console.log(`[RAG] Done — saved ${saved}/${chunks.length} chunks for document ${docId}`)
  } catch (err) {
    console.error('[RAG] processDocument error:', err.message)
  }
}


// ── Smart Chunk Scoring (keyword-match, top-K) ────────────────────────────────

/**
 * Scores each chunk by how many keywords it contains (simple include check).
 * Returns the top TOP_K chunks sorted back into document order.
 *
 * Returns { chunks: string[], found: boolean }
 */
function scoreChunks(allChunks, keywords) {
  const scored = allChunks.map((chunk, index) => {
    const lower = chunk.toLowerCase()
    const score = keywords.reduce((acc, kw) => {
      // Full-word match scores 2, substring match scores 1
      const fullWord = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'g')
      const fullHits = (lower.match(fullWord) || []).length
      const anyHits  = (lower.match(new RegExp(escapeRegex(kw), 'g')) || []).length
      return acc + fullHits * 2 + (anyHits - fullHits)
    }, 0)
    return { chunk, score, index }
  })

  // Take chunks with score > 0, best first; fall back to first TOP_K if nothing matched
  const matched = scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)

  if (matched.length === 0) {
    return { chunks: allChunks.slice(0, TOP_K), found: false }
  }

  // Re-sort selected chunks by original document position (coherent reading)
  const ordered = matched.sort((a, b) => a.index - b.index).map(c => c.chunk)
  return { chunks: ordered, found: true }
}

// ── Extract Document Headings ─────────────────────────────────────────────────

/**
 * Scans raw text for ALL-CAPS lines, numbered items, and markdown headings.
 * Returns up to 8 clean topic strings.
 */
function extractHeadings(text) {
  const headings = []
  const lines = text.split('\n')
  for (const line of lines) {
    const t = line.replace(/^[-*•>\s\d.\)]+/, '').trim()
    if (t.length < 4 || t.length > 100) continue

    if (/^[A-Z][A-Z\s\d\-:]{3,}$/.test(t)) headings.push(t.replace(/[:\-]+$/, '').trim())
    else if (/^[\d]+[\.\)]\s+[A-Z]\w{2,}/.test(line)) headings.push(t)
    else if (/^#{1,3}\s+\w/.test(line)) headings.push(t.replace(/^#+\s*/, '').trim())

    if (headings.length >= 8) break
  }
  return [...new Set(headings)]
}

/** Convert a topic string into a natural-language question. */
function topicToQuestion(topic, index) {
  const lower = topic.toLowerCase()
  if (/^(what|who|when|where|why|how)\b/.test(lower)) return `${topic}?`
  if (/\b(policy|policies|terms|conditions|rules|procedure)\b/i.test(topic))
    return `What are the ${topic}?`
  if (/\b(process|steps|method|approach)\b/i.test(topic)) return `How does ${topic} work?`
  // Alternate between "What is" and "Explain" for variety
  return index % 2 === 0 ? `What is ${topic}?` : `Explain ${topic}.`
}

// ── Retrieval (keyword scoring, same return shape as original vector API) ────

/**
 * Loads all chunks for the KB from DB, groups by document,
 * scores each chunk by keyword match, returns top-K per document.
 *
 * Returns: Array<{ content: string, file_name: string }>
 *  — same shape as the old vector search → chats.js needs zero changes.
 */
async function searchSimilarChunks(kbId, question) {
  try {
    const summaryMode = isSummaryQuestion(question)
    const keywords    = extractKeywords(question)

    console.log(`[RAG] Mode: ${summaryMode ? 'SUMMARY' : 'QA'} | keywords: [${keywords.join(', ')}]`)

    // Load every chunk for this KB in document order
    const result = await query(
      `SELECT ch.content, d.file_name, d.id AS doc_id
         FROM chunks ch
         JOIN documents d ON d.id = ch.document_id
        WHERE ch.knowledge_base_id = $1
        ORDER BY d.created_at ASC, ch.created_at ASC`,
      [kbId]
    )

    console.log(`[RAG] Loaded ${result.rows.length} chunks from DB`)

    if (result.rows.length === 0) {
      console.warn('[RAG] No chunks found — document may not have been processed yet')
      return []
    }

    // Group chunks by document
    const docMap = new Map()
    for (const row of result.rows) {
      if (!docMap.has(row.doc_id)) {
        docMap.set(row.doc_id, { file_name: row.file_name, parts: [] })
      }
      docMap.get(row.doc_id).parts.push(row.content)
    }

    const output = []

    for (const [, doc] of docMap) {
      if (summaryMode) {
        // Summary: join first SUMMARY_CHUNKS chunks only
        const summaryText = doc.parts.slice(0, SUMMARY_CHUNKS).join(' ')
        console.log(`[RAG] Summary: using ${Math.min(doc.parts.length, SUMMARY_CHUNKS)} chunks from "${doc.file_name}"`)
        output.push({ content: summaryText, file_name: doc.file_name })
        continue
      }

      if (keywords.length === 0) {
        // No usable keywords: return first TOP_K chunks
        const text = doc.parts.slice(0, TOP_K).join(' ')
        console.log(`[RAG] No keywords — returning first ${TOP_K} chunks from "${doc.file_name}"`)
        output.push({ content: text, file_name: doc.file_name })
        continue
      }

      // Smart keyword scoring across all chunks → top TOP_K
      const { chunks: topChunks, found } = scoreChunks(doc.parts, keywords)
      const text = topChunks.join(' ')

      console.log(`[RAG] ${found ? 'Matched' : 'Fallback'}: ${topChunks.length} chunks from "${doc.file_name}"`)
      output.push({ content: text, file_name: doc.file_name })
    }

    console.log(`[RAG] Returning ${output.length} result(s) to caller`)
    return output

  } catch (err) {
    console.error('[RAG] searchSimilarChunks error:', err.message)
    return []
  }
}

// ── Zero-token fallback stream ────────────────────────────────────────────────

/**
 * Returns an async generator that mimics a Groq stream but emits a single
 * fixed message. Used for hardcoded fallbacks only.
 */
async function* staticStream(text) {
  yield { choices: [{ delta: { content: text } }] }
}

// ── General-purpose AI call (no PDF context) ──────────────────────────────────

/**
 * Calls the LLM as a plain, friendly assistant — no document context injected.
 * Used for greetings, small-talk, and fallback when PDF has no relevant chunks.
 */
async function callGeneralAI(question, chatHistory = []) {
  const messages = [
    {
      role: 'system',
      content:
        'You are a friendly, knowledgeable AI assistant. '
        + 'Respond naturally, helpfully, and concisely. '
        + 'If the user asks about an uploaded document, let them know you need some keywords to search it.',
    },
    ...chatHistory.slice(-4).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ]

  return groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 512,
  })
}

// ── Answer Generation ─────────────────────────────────────────────────────────

async function generateAnswer(question, chunks, chatHistory = []) {
  try {
    const summaryMode = isSummaryQuestion(question)
    const generalChat  = isGeneralChat(question)

    // ── STEP 1: General chat → skip PDF context entirely ─────────────────
    if (generalChat) {
      console.log('[RAG] Intent: GENERAL CHAT — calling AI without PDF context')
      return callGeneralAI(question, chatHistory)
    }

    // ── STEP 2: Sanitize retrieved PDF context ────────────────────────────
    const rawContext = chunks.map(c => c.content).join('\n\n').trim()
    const contextText = sanitizeText(rawContext)

    console.log(`[RAG] generateAnswer | mode: ${summaryMode ? 'SUMMARY' : 'QA'} | context: ${contextText.length} chars | chunks: ${chunks.length}`)

    // ── STEP 3: No PDF context → fall back to general AI (no "Not found" spam) ──
    if (contextText.length === 0) {
      console.warn('[RAG] No PDF context available — falling back to general AI response')
      return callGeneralAI(
        `The user asked: "${question}". No document context is available. ` +
        'Answer as helpfully as possible from your general knowledge.',
        chatHistory
      )
    }

    // ── STEP 4: Build PDF-grounded prompt ────────────────────────────────
    let systemContent

    if (summaryMode) {
      systemContent =
        `You are an AI assistant. Summarize the following document content in clear, simple bullet points. ` +
        `Be concise and structured.\n\nDocument Content:\n${contextText}`
    } else {
      systemContent =
        `You are an AI assistant helping the user with their uploaded document.\n` +
        `Answer the question using the context below as your primary source.\n` +
        `If the exact answer isn't in the context, share what IS relevant and then ` +
        `supplement briefly from your general knowledge — do NOT just say "Not found in document".\n\n` +
        `Context:\n${contextText}`
    }

    const messages = [
      { role: 'system', content: systemContent },
      ...chatHistory.slice(-4).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: question },
    ]

    return groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 1024,
    })

  } catch (err) {
    console.error('[RAG] generateAnswer error:', err.message)
    // ── STEP 5: Graceful fallback — always respond ────────────────────────
    const fallbackText = chunks.length > 0
      ? `I couldn't generate a full answer, but here is relevant information from the document:\n\n${chunks.map(c => c.content).join('\n\n').slice(0, 1200)}`
      : `I had trouble processing that. Could you rephrase your question?`
    return staticStream(fallbackText)
  }
}

// ── Suggested Questions (no AI) ───────────────────────────────────────────────

/**
 * Generates follow-up questions without any AI call.
 *
 * 1. Tries to extract structured headings from the AI answer (markdown, bold, caps, numbered).
 * 2. Falls back to capitalised noun phrases in the answer.
 * 3. Converts topics to natural questions.
 */
async function generateFollowUps(question, answer) {
  try {
    // Extract headings from the answer text
    const fromAnswer = extractHeadings(answer)

    // Also try bold-markdown topics inside the answer
    const boldTopics = []
    const boldMatches = answer.matchAll(/\*\*([^*]{4,60})\*\*/g)
    for (const m of boldMatches) boldTopics.push(m[1].trim())

    // Noun phrase fallback
    const nounPhrases = answer.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || []

    // Merge and de-duplicate, prioritising structured headings
    const allTopics = [...fromAnswer, ...boldTopics, ...nounPhrases]
    const unique = [...new Set(allTopics)]
      .filter(t => t.length > 3 && t.length < 100)
      .slice(0, 5)

    if (unique.length === 0) return []

    return unique.map((t, i) => topicToQuestion(t, i))

  } catch (err) {
    console.error('[RAG] generateFollowUps error:', err.message)
    return []
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { processDocument, searchSimilarChunks, generateAnswer, generateFollowUps }