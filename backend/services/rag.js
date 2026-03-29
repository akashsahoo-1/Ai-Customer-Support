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
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
      pdfjsLib.GlobalWorkerOptions.workerSrc = false
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(file.buffer) })
      const pdf = await loadingTask.promise
      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        fullText += content.items.map(item => item.str).join(' ') + '\n'
      }
      return fullText
    } catch (err) {
      console.error('[RAG] PDF extraction error:', err.message)
      return file.buffer.toString('latin1').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  return file.buffer.toString('utf-8')
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
  console.log(`[RAG] Processing document ${docId}`)
  const rawText = await extractText(file)
  console.log(`[RAG] Extracted ${rawText.length} chars`)

  const chunks = splitIntoChunks(rawText)
  console.log(`[RAG] Split into ${chunks.length} chunks`)

  // Batch embed all chunks at once (Cohere supports batching)
  const batchSize = 96
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
      }
    } catch (err) {
      console.error(`[RAG] Error processing batch at ${i}:`, err.message)
    }
  }

  console.log(`[RAG] Done processing document ${docId}`)
}

async function searchSimilarChunks(kbId, question, topK = 5) {
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
  return result.rows
}

async function generateAnswer(question, chunks, chatHistory = []) {
  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.file_name}]\n${c.content}`)
    .join('\n\n---\n\n')

  const messages = [
    {
      role: 'system',
      content: `You are a helpful customer support agent. Answer questions based ONLY on the provided context documents.
If the answer is not in the context, say "I couldn't find information about that in the available documents."
Be concise, accurate, and friendly. Always cite which document you found the information in.

CONTEXT:
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