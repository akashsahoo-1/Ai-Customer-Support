const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { query } = require('../config/db')

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [kbs, docs, chats, msgs] = await Promise.all([
      query('SELECT COUNT(*)::int FROM knowledge_bases WHERE user_id = $1', [req.user.id]),
      query('SELECT COUNT(*)::int FROM documents WHERE user_id = $1', [req.user.id]),
      query('SELECT COUNT(*)::int FROM chats WHERE user_id = $1', [req.user.id]),
      query(`SELECT COUNT(*)::int FROM messages m JOIN chats c ON c.id = m.chat_id WHERE c.user_id = $1`, [req.user.id]),
    ])
    res.json({
      kb_count: kbs.rows[0].count,
      doc_count: docs.rows[0].count,
      chat_count: chats.rows[0].count,
      message_count: msgs.rows[0].count,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
