const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { query } = require('../config/db')

// GET all KBs for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT kb.*,
        COUNT(DISTINCT d.id)::int AS document_count,
        COUNT(DISTINCT c.id)::int AS chat_count
       FROM knowledge_bases kb
       LEFT JOIN documents d ON d.knowledge_base_id = kb.id
       LEFT JOIN chats c ON c.knowledge_base_id = kb.id
       WHERE kb.user_id = $1
       GROUP BY kb.id
       ORDER BY kb.created_at DESC`,
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET single KB
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST create KB
router.post('/', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Name is required' })
  try {
    const result = await query(
      'INSERT INTO knowledge_bases (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.id, name]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE KB
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await query(
      'DELETE FROM knowledge_bases WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
