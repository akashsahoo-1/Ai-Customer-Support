const router = require('express').Router()
const passport = require('passport')
const { requireAuth } = require('../middleware/auth')

// Start Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}))

// Google callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/?error=auth_failed` }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`)
  }
)

// Get current user
router.get('/me', requireAuth, (req, res) => {
  const { id, google_id, name, email, avatar, role, created_at } = req.user
  res.json({ user: { id, name, email, avatar, role, created_at } })
})

// Logout
router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy()
    res.json({ ok: true })
  })
})

module.exports = router
