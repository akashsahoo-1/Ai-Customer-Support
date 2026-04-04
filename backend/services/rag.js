const Groq = require('groq-sdk')
const { CohereClient } = require('cohere-ai')
const { query } = require('../config/db')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY })

const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 50

function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}

function splitIntoChunks(text) {
  const chunks = []
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text]
  let currentChunk = ''
  let currentTokens = 0

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence)
    if (currentTokens + sentenceTokens > CHUNK_SIZE && currentChunk) {
      chunks.push(currentChunk.trim())
      const overlapChars = CHUNK_OVERLAP * 4
      currentChunk = currentChunk.slice(-overlapChars) + sentence
      currentTokens = estimateTokens(currentChunk)
    } else {
      currentChunk += sentence
      currentTokens += sentenceTokens
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim())
  return chunks.filter(c => c.length > 20)
}

async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(file.buffer)
      const text = data.text || ''
      console.log(`[RAG] pdf-parse extracted ${text.length} chars from PDF`)
      if (text.trim().length > 0) return text
      // Fallback: raw buffer decode if pdf-parse returns empty
      console.warn('[RAG] pdf-parse returned empty text, falling back to raw decode')
      return file.buffer.toString('latin1').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
    } catch (err) {
      console.error('[RAG] PDF extraction error:', err.message)
      return file.buffer.toString('latin1').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  const text = file.buffer.toString('utf-8')
  console.log(`[RAG] TXT extracted ${text.length} chars`)
  return text
}

async function getEmbedding(texts, inputType = 'search_document') {
  const response = await cohere.embed({
    texts: Array.isArray(texts) ? texts : [texts],
    model: 'embed-english-v3.0',
    inputType,
  })
  return response.embeddings
}

async function processDocument(docId, kbId, file) {
  console.log(`[RAG] Processing document ${docId} | type: ${file.mimetype}`)
  const rawText = await extractText(file)
  console.log(`[RAG] Extracted text length: ${rawText.length} chars`)

  if (rawText.trim().length === 0) {
    console.error(`[RAG] No text extracted from document ${docId} — aborting chunk/embed`)
    return
  }

  const chunks = splitIntoChunks(rawText)
  console.log(`[RAG] Number of chunks created: ${chunks.length}`)

  if (chunks.length === 0) {
    console.error(`[RAG] No chunks produced for document ${docId}`)
    return
  }

  // Batch embed all chunks (Cohere supports up to 96 per call)
  const batchSize = 96
  let totalEmbedded = 0
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    try {
      const embeddings = await getEmbedding(batch, 'search_document')
      for (let j = 0; j < batch.length; j++) {
        const vectorStr = `[${embeddings[j].join(',')}]`
        await query(
          `INSERT INTO chunks (document_id, knowledge_base_id, content, embedding)
           VALUES ($1, $2, $3, $4::vector)`,
          [docId, kbId, batch[j], vectorStr]
        )
        totalEmbedded++
        console.log(`[RAG] Embedding created for chunk ${totalEmbedded} (batch ${Math.floor(i / batchSize) + 1})`)
      }
    } catch (err) {
      console.error(`[RAG] Error processing batch at index ${i}:`, err.message)
    }
  }

  console.log(`[RAG] Done processing document ${docId} — total chunks embedded: ${totalEmbedded}`)
}

async function searchSimilarChunks(kbId, question, topK = 5) {
  console.log(`[RAG] Generating query embedding for: "${question.substring(0, 80)}..."`)
  const embeddings = await getEmbedding([question], 'search_query')
  const vectorStr = `[${embeddings[0].join(',')}]`

  const result = await query(
    `SELECT ch.content, d.file_name,
      1 - (ch.embedding <=> $1::vector) AS similarity
     FROM chunks ch
     JOIN documents d ON d.id = ch.document_id
     WHERE ch.knowledge_base_id = $2
     ORDER BY ch.embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, kbId, topK]
  )
  console.log(`[RAG] Retrieved ${result.rows.length} chunks for kbId=${kbId}`)
  if (result.rows.length > 0) {
    result.rows.forEach((r, i) =>
      console.log(`[RAG]   chunk[${i + 1}] similarity=${(+r.similarity).toFixed(4)} file=${r.file_name}`)
    )
  } else {
    console.warn(`[RAG] No chunks found — PDF may not have been processed yet or KB is empty`)
  }
  return result.rows
}

async function generateAnswer(question, chunks, chatHistory = []) {
  const context = chunks.length > 0
    ? chunks.map((c, i) => `[Source ${i + 1}: ${c.file_name}]\n${c.content}`).join('\n\n---\n\n')
    : 'No relevant context found.'

  console.log(`[RAG] Generating answer with ${chunks.length} context chunks`)

  const messages = [
    {
      role: 'system',
      content: `You are an AI assistant. Answer ONLY from the provided context below.
If the answer is not found in the context, say "Not found in document".
Do NOT make up information. Be concise and cite which source document you used.

Context:
${context}`,
    },
    ...chatHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ]

  return groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 1024,
  })
}

async function generateFollowUps(question, answer) {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Generate 3 concise follow-up questions based on the Q&A. Return JSON array of strings only. No markdown.',
        },
        { role: 'user', content: `Q: ${question}\nA: ${answer}` },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })
    const text = response.choices[0].message.content.trim()
    return JSON.parse(text)
  } catch {
    return []
  }
}

module.exports = { processDocument, searchSimilarChunks, generateAnswer, generateFollowUps }