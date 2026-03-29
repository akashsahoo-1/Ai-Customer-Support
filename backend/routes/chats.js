const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { query } = require('../config/db')
const { searchSimilarChunks, generateAnswer, generateFollowUps } = require('../services/rag')

// GET chats for a KB
router.get('/', requireAuth, async (req, res) => {
  const { kbId } = req.query
  if (!kbId) return res.status(400).json({ error: 'kbId required' })
  try {
    const result = await query(
      `SELECT c.*,
        (SELECT content FROM messages WHERE chat_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) AS first_message,
        COUNT(m.id)::int AS message_count
       FROM chats c
       LEFT JOIN messages m ON m.chat_id = c.id
       WHERE c.knowledge_base_id = $1 AND c.user_id = $2
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [kbId, req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST create new chat
router.post('/', requireAuth, async (req, res) => {
  const { kbId } = req.body
  if (!kbId) return res.status(400).json({ error: 'kbId required' })
  try {
    const result = await query(
      'INSERT INTO chats (user_id, knowledge_base_id) VALUES ($1, $2) RETURNING *',
      [req.user.id, kbId]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET messages for a chat
router.get('/:chatId/messages', requireAuth, async (req, res) => {
  try {
    // Verify chat belongs to user
    const chat = await query(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [req.params.chatId, req.user.id]
    )
    if (!chat.rows[0]) return res.status(404).json({ error: 'Chat not found' })

    const msgs = await query(
      'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
      [req.params.chatId]
    )
    res.json(msgs.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST stream answer (SSE)
router.post('/:chatId/stream', requireAuth, async (req, res) => {
  const { chatId } = req.params
  const { question } = req.body

  if (!question?.trim()) return res.status(400).json({ error: 'Question required' })

  // Verify chat
  const chatCheck = await query(
    'SELECT * FROM chats WHERE id = $1 AND user_id = $2',
    [chatId, req.user.id]
  )
  if (!chatCheck.rows[0]) return res.status(404).json({ error: 'Chat not found' })

  const kbId = chatCheck.rows[0].knowledge_base_id

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    // Save user message
    await query(
      'INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)',
      [chatId, 'user', question.trim()]
    )

    // Get recent history
    const history = await query(
      'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 10',
      [chatId]
    )
    const chatHistory = history.rows.reverse()

    // Vector search
    const relevantChunks = await searchSimilarChunks(kbId, question)

    // Send sources
    const sources = [...new Map(relevantChunks.map(c => [c.file_name, c])).values()]
      .map(c => ({ file_name: c.file_name }))
    sendEvent({ type: 'sources', sources })

    // Stream GPT-4o response
    const stream = await generateAnswer(question, relevantChunks, chatHistory)

    let fullContent = ''
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || ''
      if (token) {
        fullContent += token
        sendEvent({ type: 'token', content: token })
      }
    }

    // Generate follow-ups
    const followUps = await generateFollowUps(question, fullContent)
    sendEvent({ type: 'follow_ups', questions: followUps })

    // Save AI message
    await query(
      'INSERT INTO messages (chat_id, role, content, sources) VALUES ($1, $2, $3, $4)',
      [chatId, 'assistant', fullContent, JSON.stringify(sources)]
    )

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[STREAM ERROR]', err.message)
    sendEvent({ type: 'error', message: 'Failed to generate response' })
    res.end()
  }
})

module.exports = router
