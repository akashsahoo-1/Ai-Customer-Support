/**
 * rag.js — Keyword-based retrieval pipeline (no vector embeddings).
 *
 * Upload  : pdf-parse → split into paragraphs → save chunks (no embedding)
 * Question: lowercase keywords → score chunks → trim to ≤700 words → LLM
 * Summary : first 500 words → bullet-point prompt
 * Follow-ups: heading / entity extraction from answer (no AI call)
 *
 * Exported API is identical to the vector version so routes/UI need no changes.
 */

const Groq = require('groq-sdk')
const { query } = require('../config/db')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Constants ────────────────────────────────────────────────────────────────

const CHUNK_CHARS   = 900   // target chars per stored chunk (≈ paragraph-sized)
const MAX_CTX_WORDS = 700   // max words sent to LLM for a normal question
const SUMMARY_WORDS = 500   // max words sent to LLM for a summary request

// Words to ignore when building keyword list
const STOP_WORDS = new Set([
  'what','is','the','a','an','of','in','on','at','to','for','with',
  'how','why','when','where','who','are','was','were','has','have',
  'had','do','does','did','can','could','should','would','will','be',
  'been','being','i','my','your','their','its','this','that','these',
  'those','me','him','her','us','them','and','or','but','so','if',
  'then','also','just','about','tell','give','explain','describe',
])

// ── Text extraction ──────────────────────────────────────────────────────────

async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(file.buffer)
      const text = (data.text || '').trim()
      console.log(`[RAG] pdf-parse extracted ${text.length} chars from PDF`)
      if (text.length > 0) return text
      console.warn('[RAG] pdf-parse returned empty text — falling back to raw decode')
    } catch (err) {
      console.error('[RAG] PDF extraction error:', err.message)
    }
    // Fallback: best-effort latin-1 decode
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
}

// ── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Splits text on blank lines (paragraph boundaries).
 * Merges short paragraphs until CHUNK_CHARS is reached.
 */
function splitIntoChunks(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 20)

  const chunks = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current += (current ? ' ' : '') + para
    }
  }
  if (current.trim()) chunks.push(current.trim())

  console.log(`[RAG] Split into ${chunks.length} chunks`)
  return chunks
}

// ── Process & store document (no embedding) ──────────────────────────────────

async function processDocument(docId, kbId, file) {
  try {
    console.log(`[RAG] Processing document ${docId} | type: ${file.mimetype}`)

    const rawText = await extractText(file)
    console.log(`[RAG] Extracted text length: ${rawText.length} chars`)

    if (rawText.length === 0) {
      console.error(`[RAG] No text extracted for ${docId} — aborting`)
      return
    }

    const chunks = splitIntoChunks(rawText)
    if (chunks.length === 0) {
      console.error(`[RAG] No chunks produced for ${docId}`)
      return
    }

    let saved = 0
    for (const chunk of chunks) {
      try {
        // embedding column is nullable — we intentionally skip it here
        await query(
          `INSERT INTO chunks (document_id, knowledge_base_id, content)
           VALUES ($1, $2, $3)`,
          [docId, kbId, chunk]
        )
        saved++
      } catch (err) {
        console.error(`[RAG] Error saving chunk ${saved + 1}:`, err.message)
      }
    }

    console.log(`[RAG] Done — saved ${saved}/${chunks.length} chunks for document ${docId}`)
  } catch (err) {
    console.error('[RAG] processDocument error:', err.message)
  }
}

// ── Keyword helpers ──────────────────────────────────────────────────────────

/** Returns trimmed keywords from a question string. */
function extractKeywords(question) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

/** Trim text to at most `maxWords` words. */
function trimToWords(text, maxWords) {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + ' …'
}

// ── Retrieval (keyword-based) ─────────────────────────────────────────────────

/**
 * Replaces vector search with keyword scoring.
 * Returns chunks shaped as { content, file_name } so callers (chats.js) need
 * no changes.
 */
async function searchSimilarChunks(kbId, question) {
  try {
    const isSummary = /\b(summary|summarize|summarise|overview|recap)\b/i.test(question)
    const keywords  = extractKeywords(question)
    console.log(`[RAG] Mode: ${isSummary ? 'summary' : 'keyword'} | keywords: [${keywords.join(', ')}]`)

    // Fetch all stored chunks for this knowledge base (order by insertion = document order)
    const result = await query(
      `SELECT ch.content, d.file_name
         FROM chunks ch
         JOIN documents d ON d.id = ch.document_id
        WHERE ch.knowledge_base_id = $1
        ORDER BY ch.created_at ASC`,
      [kbId]
    )

    const allChunks = result.rows
    console.log(`[RAG] Total chunks in KB: ${allChunks.length}`)

    if (allChunks.length === 0) {
      console.warn('[RAG] No chunks found — PDF may not have been processed yet')
      return []
    }

    // ── Summary mode: first N words ───────────────────────────────────────
    if (isSummary) {
      let wordCount = 0
      const selected = []
      for (const chunk of allChunks) {
        const words = chunk.content.split(/\s+/).length
        if (wordCount + words > SUMMARY_WORDS && selected.length > 0) break
        selected.push(chunk)
        wordCount += words
      }
      console.log(`[RAG] Summary: selected ${selected.length} chunks (~${wordCount} words)`)
      return selected
    }

    // ── Keyword mode: score & rank ────────────────────────────────────────
    if (keywords.length === 0) {
      // No usable keywords → return first few chunks
      console.log('[RAG] No keywords extracted — returning first 3 chunks')
      return allChunks.slice(0, 3)
    }

    const scored = allChunks.map(chunk => {
      const lower = chunk.content.toLowerCase()
      const score = keywords.reduce((acc, kw) => {
        const hits = (lower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        return acc + hits
      }, 0)
      return { ...chunk, score }
    })

    // Keep only chunks that matched at least one keyword, sorted best-first
    const ranked = scored
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)

    // Fall back to document-order first chunks if nothing matched
    const candidates = ranked.length > 0 ? ranked : allChunks.slice(0, 3)

    // Trim to MAX_CTX_WORDS total
    let wordCount = 0
    const selected = []
    for (const chunk of candidates) {
      const words = chunk.content.split(/\s+/).length
      if (wordCount + words > MAX_CTX_WORDS && selected.length > 0) break
      selected.push(chunk)
      wordCount += words
    }

    console.log(`[RAG] Retrieved ${selected.length} chunks (~${wordCount} words)`)
    selected.forEach((c, i) =>
      console.log(`[RAG]   chunk[${i + 1}] score=${c.score ?? 0} file=${c.file_name}`)
    )
    return selected

  } catch (err) {
    console.error('[RAG] searchSimilarChunks error:', err.message)
    return []
  }
}

// ── Answer generation ────────────────────────────────────────────────────────

async function generateAnswer(question, chunks, chatHistory = []) {
  try {
    const isSummary = /\b(summary|summarize|summarise|overview|recap)\b/i.test(question)

    const contextText = chunks.length > 0
      ? chunks.map(c => c.content).join('\n\n')
      : ''

    // Guard: if there is truly no context, tell the user rather than hallucinating
    if (contextText.trim().length === 0) {
      console.warn('[RAG] No context text available — returning empty-context stream')
    }

    console.log(`[RAG] Generating answer (${isSummary ? 'summary' : 'QA'}) with ${chunks.length} chunks`)

    let systemContent
    if (isSummary) {
      systemContent =
        `Summarize the following document content in clear bullet points. Be concise and cover the main points.\n\n` +
        `Content:\n${contextText}`
    } else {
      systemContent =
        `You are an AI assistant. Answer ONLY from the provided context below.\n` +
        `If the answer is not found in the context, say "Not found in document".\n` +
        `Do NOT make up information. Be concise.\n\n` +
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
    throw err
  }
}

// ── Suggested questions (no AI) ──────────────────────────────────────────────

/**
 * Extracts topic-based follow-up questions from the AI answer without making
 * any additional API call.
 *
 * Strategy:
 *  1. Pull ALL-CAPS lines, numbered-list items, or markdown headings from the answer.
 *  2. If none found, grab capitalised noun phrases (e.g. "Payment Terms", "Refund Policy").
 *  3. Convert them to natural questions.
 */
async function generateFollowUps(question, answer) {
  try {
    const lines   = answer.split('\n')
    const topics  = []

    for (const line of lines) {
      const t = line.replace(/^[-*•>\s]+/, '').trim()   // strip list markers
      if (t.length < 5 || t.length > 120) continue

      // ALL-CAPS heading  (e.g. "TERMS AND CONDITIONS")
      if (/^[A-Z][A-Z\s\d\-:]{4,}$/.test(t)) {
        topics.push(t.replace(/[:\-]+$/, '').trim())
        continue
      }
      // Numbered item  (e.g. "1. Eligibility" or "2) Payment")
      if (/^[\d]+[\.\)]\s+\w/.test(t)) {
        topics.push(t.replace(/^[\d]+[\.\)\s]+/, '').trim())
        continue
      }
      // Markdown heading  (e.g. "## Refund Policy")
      if (/^#{1,3}\s+\w/.test(t)) {
        topics.push(t.replace(/^#+\s*/, '').trim())
        continue
      }
      // Bold markdown  (e.g. "**Delivery time**")
      const bold = t.match(/\*\*([^*]{4,60})\*\*/)
      if (bold) {
        topics.push(bold[1].trim())
        continue
      }
    }

    // Fallback: pull capitalised noun phrases from the answer body
    if (topics.length === 0) {
      const phrases = answer.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []
      topics.push(...phrases.slice(0, 6))
    }

    // Deduplicate and build questions
    const unique = [...new Set(topics)].slice(0, 5)
    if (unique.length === 0) return []

    return unique.map(topic => {
      const lower = topic.toLowerCase()
      if (/^(what|who|when|where|why|how)\b/.test(lower)) return `${topic}?`
      if (/\b(policy|policies|terms|conditions|rules)\b/i.test(topic))
        return `What are the ${topic}?`
      return `What is ${topic}?`
    })

  } catch (err) {
    console.error('[RAG] generateFollowUps error:', err.message)
    return []
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = { processDocument, searchSimilarChunks, generateAnswer, generateFollowUps }