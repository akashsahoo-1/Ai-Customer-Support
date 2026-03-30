const router = require('express').Router()
const passport = require('passport')
const { requireAuth } = require('../middleware/auth')

// Start Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}))

// Google callback — use custom callback for explicit error handling
router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

      if (err) {
        console.error('[Google OAuth] Strategy error:', err)
        return res.redirect(`${frontendUrl}/?error=auth_failed`)
      }

      if (!user) {
        console.warn('[Google OAuth] No user returned:', info)
        return res.redirect(`${frontendUrl}/?error=auth_failed`)
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[Google OAuth] Login error:', loginErr)
          return res.redirect(`${frontendUrl}/?error=auth_failed`)
        }
        console.log('[Google OAuth] Login success for user:', user.email)
        return res.redirect(`${frontendUrl}/auth/callback`)
      })
    })(req, res, next)
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
