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

const STORE_CHUNK_CHARS = 3000  // chars per DB chunk (keeps paragraph groups together)
const MAX_CTX_CHARS     = 3000  // max chars sent to AI for a QA question (~600–700 words)
const SUMMARY_MAX_CHARS = 2500  // max chars sent to AI for a summary request (~500–600 words)
const SENTENCE_WINDOW   = 3     // sentences grouped per scored window

// Common English words to ignore during keyword extraction
const STOP_WORDS = new Set([
  'what','is','the','a','an','of','in','on','at','to','for','with',
  'how','why','when','where','who','are','was','were','has','have',
  'had','do','does','did','can','could','should','would','will','be',
  'been','being','i','my','your','their','its','this','that','these',
  'those','me','him','her','us','them','and','or','but','so','if',
  'then','also','just','about','tell','give','explain','describe',
  'please','get','any','some','all','more','much','many','very',
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
      try {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(file.buffer)
        const text = (data.text || '').trim()
        console.log(`[RAG] pdf-parse extracted ${text.length} chars from PDF`)
        if (text.length > 0) return text
        console.warn('[RAG] pdf-parse returned empty text — falling back to latin-1 decode')
      } catch (err) {
        console.error('[RAG] pdf-parse error:', err.message)
      }
      // Best-effort raw decode fallback
      return file.buffer
        .toString('latin1')
        .replace(/[^\x20-\x7E\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
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

// ── Chunking (store full text as large blocks) ────────────────────────────────

/**
 * Splits text into paragraph-merged blocks of ~STORE_CHUNK_CHARS.
 * Larger blocks = fewer DB rows + preserves context across paragraphs.
 */
function buildStorageChunks(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 20)

  const chunks = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length > 0 && current.length + para.length + 2 > STORE_CHUNK_CHARS) {
      chunks.push(current.trim())
      current = para
    } else {
      current += (current ? '\n\n' : '') + para
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks
}

// ── Process & Store Document ──────────────────────────────────────────────────

async function processDocument(docId, kbId, file) {
  try {
    console.log(`[RAG] Processing document ${docId} | type: ${file.mimetype}`)

    const fullText = await extractText(file)
    console.log(`[RAG] Extracted text: ${fullText.length} chars`)

    if (fullText.length === 0) {
      console.error(`[RAG] No text extracted for document ${docId} — aborting`)
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

// ── Local Text Search (sentence-window scoring) ───────────────────────────────

/**
 * Searches fullText locally using sliding sentence windows.
 *
 * Steps:
 *  1. Split text into sentences.
 *  2. Group into overlapping windows of SENTENCE_WINDOW sentences.
 *  3. Score each window by total keyword hits.
 *  4. Take the highest-scoring windows, re-sort by original position (coherent reading).
 *  5. Join windows until maxChars is reached.
 *
 * Returns { text: string, found: boolean }
 */
function extractRelevantText(fullText, keywords, maxChars) {
  // Normalise line breaks → split into sentences
  const sentences = fullText
    .replace(/\r?\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z])/)   // split after sentence-ending punctuation
    .map(s => s.trim())
    .filter(s => s.length > 10)

  if (sentences.length === 0) return { text: '', found: false }

  // Build sliding windows
  const windows = []
  for (let i = 0; i < sentences.length; i += Math.ceil(SENTENCE_WINDOW / 2)) {
    const group = sentences.slice(i, i + SENTENCE_WINDOW)
    const windowText = group.join(' ')
    const lower = windowText.toLowerCase()
    const score = keywords.reduce((acc, kw) => {
      const hits = (lower.match(new RegExp(escapeRegex(kw), 'g')) || []).length
      return acc + hits
    }, 0)
    windows.push({ text: windowText, score, index: i })
  }

  // Sort by relevance score
  const matched = windows
    .filter(w => w.score > 0)
    .sort((a, b) => b.score - a.score)

  if (matched.length === 0) return { text: '', found: false }

  // Take top windows, re-sort by original position for readable output
  const topWindows = matched.slice(0, 12).sort((a, b) => a.index - b.index)

  // Concatenate until maxChars
  let result = ''
  for (const w of topWindows) {
    if (result.length > 0 && result.length + w.text.length + 2 > maxChars) break
    result += (result ? ' ' : '') + w.text
  }

  return { text: result.trim(), found: result.trim().length > 0 }
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

    if (/^[A-Z][A-Z\s\d\-:]{3,}$/.test(t))           headings.push(t.replace(/[:\-]+$/, '').trim())
    else if (/^[\d]+[\.\)]\s+[A-Z]\w{2,}/.test(line)) headings.push(t)
    else if (/^#{1,3}\s+\w/.test(line))                headings.push(t.replace(/^#+\s*/, '').trim())

    if (headings.length >= 8) break
  }
  return [...new Set(headings)]
}

/** Convert a topic string into a natural-language question. */
function topicToQuestion(topic) {
  const lower = topic.toLowerCase()
  if (/^(what|who|when|where|why|how)\b/.test(lower))          return `${topic}?`
  if (/\b(policy|policies|terms|conditions|rules|procedure)\b/i.test(topic))
                                                                 return `What are the ${topic}?`
  if (/\b(process|steps|method|approach)\b/i.test(topic))      return `How does ${topic} work?`
  return `What is ${topic}?`
}

// ── Retrieval (replaces vector search, same return shape) ─────────────────────

/**
 * Loads all chunks for the KB from DB, reconstructs per-document full text,
 * then does local keyword/sentence-window search.
 *
 * Returns: Array<{ content: string, file_name: string }>
 *  — same shape as the old vector search so chats.js needs no changes.
 */
async function searchSimilarChunks(kbId, question) {
  try {
    const summaryMode = isSummaryQuestion(question)
    const keywords    = extractKeywords(question)

    console.log(`[RAG] Mode: ${summaryMode ? 'SUMMARY' : 'QA'} | keywords: [${keywords.join(', ')}]`)

    // Load every chunk for this KB, ordered by document → insertion order
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

    // Group chunks by document so we can search each doc separately
    const docMap = new Map()
    for (const row of result.rows) {
      if (!docMap.has(row.doc_id)) {
        docMap.set(row.doc_id, { file_name: row.file_name, parts: [] })
      }
      docMap.get(row.doc_id).parts.push(row.content)
    }

    const output = []

    for (const [, doc] of docMap) {
      const fullText = doc.parts.join('\n\n')

      if (summaryMode) {
        // Summary: first SUMMARY_MAX_CHARS of the document
        const text = fullText.slice(0, SUMMARY_MAX_CHARS)
        console.log(`[RAG] Summary: using first ${text.length} chars from "${doc.file_name}"`)
        output.push({ content: text, file_name: doc.file_name })
        continue
      }

      if (keywords.length === 0) {
        // No useful keywords: return opening of document
        console.log(`[RAG] No keywords — returning first ${MAX_CTX_CHARS} chars from "${doc.file_name}"`)
        output.push({ content: fullText.slice(0, MAX_CTX_CHARS), file_name: doc.file_name })
        continue
      }

      // Sentence-window keyword search
      const { text, found } = extractRelevantText(fullText, keywords, MAX_CTX_CHARS)

      if (found) {
        console.log(`[RAG] Found ${text.length} chars of relevant text in "${doc.file_name}"`)
        output.push({ content: text, file_name: doc.file_name })
      } else {
        console.warn(`[RAG] No keyword match in "${doc.file_name}"`)
      }
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
    const contextText = chunks.map(c => c.content).join('\n\n').trim()

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
      model:       'llama-3.3-70b-versatile',
      messages,
      stream:      true,
      temperature: 0.2,
      max_tokens:  1024,
    })

  } catch (err) {
    console.error('[RAG] generateAnswer error:', err.message)
    // Return a static fallback — never let the route crash
    return staticStream('Sorry, I encountered an error generating the response. Please try again.')
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

    return unique.map(topicToQuestion)

  } catch (err) {
    console.error('[RAG] generateFollowUps error:', err.message)
    return []
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { processDocument, searchSimilarChunks, generateAnswer, generateFollowUps }