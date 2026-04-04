const router = require('express').Router()
const passport = require('passport')
const { requireAuth } = require('../middleware/auth')

// ✅ TEST ROUTE (DEBUG)
router.get('/test', (req, res) => {
  res.send('Auth route working ✅')
})

// ✅ Start Google OAuth
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
)

// ✅ Google Callback
router.get('/google/callback',
  (req, res, next) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

    const safetyTimer = setTimeout(() => {
      console.error('[Google OAuth] Timeout')
      if (!res.headersSent) {
        res.redirect(`${frontendUrl}/?error=auth_timeout`)
      }
    }, 8000)

    passport.authenticate('google', (err, user, info) => {
      clearTimeout(safetyTimer)

      if (err) {
        console.error('[Google OAuth] Error:', err.message)
        return res.redirect(`${frontendUrl}/?error=auth_failed`)
      }

      if (!user) {
        console.warn('[Google OAuth] No user:', info)
        return res.redirect(`${frontendUrl}/?error=auth_failed`)
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[Google OAuth] Login error:', loginErr.message)
          return res.redirect(`${frontendUrl}/?error=auth_failed`)
        }

        console.log('[Google OAuth] Success:', user.email)
        return res.redirect(`${frontendUrl}/auth/callback`)
      })
    })(req, res, next)
  }
)

// ✅ Get current user
router.get('/me', requireAuth, (req, res) => {
  const { id, google_id, name, email, avatar, role, created_at } = req.user
  res.json({ user: { id, name, email, avatar, role, created_at } })
})

// ✅ Logout
router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy()
    res.json({ ok: true })
  })
})

module.exports = router