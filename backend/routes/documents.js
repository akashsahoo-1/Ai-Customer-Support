const router = require('express').Router()
const multer = require('multer')
const { requireAuth } = require('../middleware/auth')
const { query } = require('../config/db')
const { processDocument } = require('../services/rag')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF and TXT files are allowed'))
    }
  },
})

// GET documents for a KB
router.get('/', requireAuth, async (req, res) => {
  const { kbId } = req.query
  if (!kbId) return res.status(400).json({ error: 'kbId required' })
  try {
    const result = await query(
      `SELECT d.*,
        COUNT(ch.id)::int AS chunk_count
       FROM documents d
       LEFT JOIN chunks ch ON ch.document_id = d.id
       WHERE d.knowledge_base_id = $1 AND d.user_id = $2
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [kbId, req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST upload document
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const { kbId } = req.body
  if (!kbId) return res.status(400).json({ error: 'kbId required' })
  if (!req.file) return res.status(400).json({ error: 'File required' })

  // Verify KB belongs to user
  const kbCheck = await query(
    'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [kbId, req.user.id]
  )
  if (!kbCheck.rows[0]) return res.status(404).json({ error: 'Knowledge base not found' })

  try {
    // Insert document record
    const docResult = await query(
      `INSERT INTO documents (knowledge_base_id, user_id, file_name, file_size)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [kbId, req.user.id, req.file.originalname, req.file.size]
    )
    const doc = docResult.rows[0]

    // Process asynchronously (extract, chunk, embed, store)
    processDocument(doc.id, kbId, req.file).catch(err => {
      console.error('[RAG] Processing error:', err.message)
    })

    res.status(201).json({ doc, message: 'Upload started, processing in background' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE document
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await query(
      'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    )
    if (!doc.rows[0]) return res.status(404).json({ error: 'Not found' })

    await query('DELETE FROM chunks WHERE document_id = $1', [req.params.id])
    await query('DELETE FROM documents WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
