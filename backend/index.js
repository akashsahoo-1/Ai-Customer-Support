require('dotenv').config()

// --- Startup env diagnostic (logging only, no logic) ---
console.log('[ENV CHECK] GOOGLE_CLIENT_ID    :', process.env.GOOGLE_CLIENT_ID    ? '✅ loaded' : '❌ MISSING')
console.log('[ENV CHECK] GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ loaded' : '❌ MISSING')
console.log('[ENV CHECK] GOOGLE_CALLBACK_URL :', process.env.GOOGLE_CALLBACK_URL  || '❌ MISSING')
console.log('[ENV CHECK] FRONTEND_URL        :', process.env.FRONTEND_URL         || '❌ MISSING')
console.log('[ENV CHECK] SESSION_SECRET      :', process.env.SESSION_SECRET       ? '✅ loaded' : '❌ MISSING')
console.log('[ENV CHECK] DATABASE_URL        :', process.env.DATABASE_URL         ? '✅ loaded' : '❌ MISSING')
// --------------------------------------------------------
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const session = require('express-session')
const passport = require('passport')

const authRoutes = require('./routes/auth')
const kbRoutes = require('./routes/knowledgeBases')
const docRoutes = require('./routes/documents')
const chatRoutes = require('./routes/chats')
const statsRoutes = require('./routes/stats')
const adminRoutes = require('./routes/admin')

const app = express()

// Trust Railway's reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1)

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Session
// On Railway (always HTTPS), we need secure + sameSite:none for cross-site cookies.
// NODE_ENV alone is unreliable — check RAILWAY_ENVIRONMENT or GOOGLE_CALLBACK_URL to detect production.
const isProduction = process.env.NODE_ENV === 'production' ||
  (process.env.GOOGLE_CALLBACK_URL || '').startsWith('https://')

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,         // Must be true when sameSite:'none'
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: isProduction ? 'none' : 'lax',
  },
}))

// Passport
require('./config/passport')
app.use(passport.initialize())
app.use(passport.session())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/knowledge-bases', kbRoutes)
app.use('/api/documents', docRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/admin', adminRoutes)

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${isProduction ? 'production' : 'development'}]`)
})

// Prevent uncaught async errors from taking down the server silently
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})
