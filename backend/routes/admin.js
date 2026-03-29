const router = require('express').Router()
const { requireAdmin } = require('../middleware/auth')
const { query } = require('../config/db')

// Platform-wide stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [users, kbs, docs, chunks, chats, msgs] = await Promise.all([
      query('SELECT COUNT(*)::int FROM users'),
      query('SELECT COUNT(*)::int FROM knowledge_bases'),
      query('SELECT COUNT(*)::int FROM documents'),
      query('SELECT COUNT(*)::int FROM chunks'),
      query('SELECT COUNT(*)::int FROM chats'),
      query('SELECT COUNT(*)::int FROM messages'),
    ])
    res.json({
      total_users: users.rows[0].count,
      total_kbs: kbs.rows[0].count,
      total_docs: docs.rows[0].count,
      total_chunks: chunks.rows[0].count,
      total_chats: chats.rows[0].count,
      total_messages: msgs.rows[0].count,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// All users with metrics
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*,
        COUNT(DISTINCT kb.id)::int AS kb_count,
        COUNT(DISTINCT d.id)::int AS doc_count,
        COUNT(DISTINCT c.id)::int AS chat_count
       FROM users u
       LEFT JOIN knowledge_bases kb ON kb.user_id = u.id
       LEFT JOIN documents d ON d.user_id = u.id
       LEFT JOIN chats c ON c.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
