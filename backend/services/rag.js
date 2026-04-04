/**
 * rag.js — Hybrid keyword-retrieval RAG pipeline.
 *
 * UPLOAD  : pdf-parse → store full text as large chunks (no embeddings needed)
 * QUESTION: keyword extraction → sentence-window scoring → top paragraphs → AI
 * SUMMARY : first 500 words → bullet-point AI prompt
 * FOLLOW-UPS: extract headings from doc text + answer (zero AI tokens)
 *
 * Exported API matches the original vector version exactly → no route/UI changes.
 */

'use strict'

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

// ── Text Extraction ───────────────────────────────────────────────────────────

async function extractText(file) {
  try {
    if (file.mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(file.buffer)
      const text = (data.text || '').trim()
      console.log(`[RAG] pdf-parse extracted ${text.length} chars from PDF`)
      if (text.length > 0) return text
      // pdf-parse returned nothing — do NOT fall back to binary decode
      console.error('[RAG] pdf-parse returned empty text — PDF may be scanned/image-only')
      return ''
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
 * fixed message. Used when no relevant context is found — avoids an AI call.
 */
async function* staticStream(text) {
  yield { choices: [{ delta: { content: text } }] }
}

// ── Answer Generation ─────────────────────────────────────────────────────────

async function generateAnswer(question, chunks, chatHistory = []) {
  try {
    const summaryMode = isSummaryQuestion(question)

    // Sanitize context BEFORE sending to AI — absolute guarantee: no binary data
    const rawContext = chunks.map(c => c.content).join('\n\n').trim()
    const contextText = sanitizeText(rawContext)

    console.log(`[RAG] generateAnswer | mode: ${summaryMode ? 'SUMMARY' : 'QA'} | context: ${contextText.length} chars | chunks: ${chunks.length}`)

    // ── No context → short-circuit without an AI call ────────────────────
    if (contextText.length === 0) {
      console.warn('[RAG] No context available — returning static fallback (0 tokens used)')
      return staticStream('Not found in document.')
    }

    // ── Build prompt ──────────────────────────────────────────────────────
    let systemContent

    if (summaryMode) {
      systemContent =
        `Summarize this document in simple bullet points:\n\n${contextText}`
    } else {
      systemContent =
        `You are an AI assistant.\n` +
        `Answer ONLY using the provided context.\n` +
        `If the answer is not found, say "Not found in document".\n\n` +
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
    // Fallback: return the raw chunk content directly so the user still gets an answer
    const fallbackText = chunks.length > 0
      ? `Here is what I found in the document:\n\n${chunks.map(c => c.content).join('\n\n').slice(0, 1200)}`
      : 'Not found in document.'
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