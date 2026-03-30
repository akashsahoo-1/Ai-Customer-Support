const router = require('express').Router()
const passport = require('passport')
const { requireAuth } = require('../middleware/auth')

// Start Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}))

// Google callback — custom callback guarantees a response is always sent
router.get('/google/callback',
  (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

    // Safety net: if passport never calls back (e.g. DB hangs past its own timeout),
    // this fires after 8s and sends a redirect so the request never hangs.
    const safetyTimer = setTimeout(() => {
      console.error('[Google OAuth] Callback timed out — no response sent after 8s')
      if (!res.headersSent) {
        res.redirect(`${frontendUrl}/?error=auth_timeout`)
      }
    }, 8000)

    passport.authenticate('google', (err, user, info) => {
      clearTimeout(safetyTimer)

      if (err) {
        console.error('[Google OAuth] Strategy error:', err.message)
        return res.redirect(`${frontendUrl}/?error=auth_failed`)
      }

      if (!user) {
        console.warn('[Google OAuth] No user returned:', info)
        return res.redirect(`${frontendUrl}/?error=auth_failed`)
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[Google OAuth] Session login error:', loginErr.message)
          return res.redirect(`${frontendUrl}/?error=auth_failed`)
        }
        console.log('[Google OAuth] Login success:', user.email)
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
