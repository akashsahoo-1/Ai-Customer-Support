require('dotenv').config()

// --- ENV CHECK ---
console.log('[ENV CHECK] GOOGLE_CLIENT_ID    :', process.env.GOOGLE_CLIENT_ID ? '✅ loaded' : '❌ MISSING')
console.log('[ENV CHECK] GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ loaded' : '❌ MISSING')
console.log('[ENV CHECK] GOOGLE_CALLBACK_URL :', process.env.GOOGLE_CALLBACK_URL || '❌ MISSING')
console.log('[ENV CHECK] FRONTEND_URL        :', process.env.FRONTEND_URL || '❌ MISSING')
console.log('[ENV CHECK] SESSION_SECRET      :', process.env.SESSION_SECRET ? '✅ loaded' : '❌ MISSING')
console.log('[ENV CHECK] DATABASE_URL        :', process.env.DATABASE_URL ? '✅ loaded' : '❌ MISSING')
// ------------------

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

// ✅ IMPORTANT: Trust proxy (Railway)
app.set('trust proxy', 1)

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// ✅ CORS (FIXED)
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}))

// ✅ IMPORTANT: handle preflight (fixes hanging)
app.options('*', cors())

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ✅ Session (FIXED)
const isProduction = true // Railway = always HTTPS

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  proxy: true, // 🔥 important for Railway
  cookie: {
    secure: true,          // REQUIRED
    httpOnly: true,
    sameSite: 'none',      // REQUIRED for cross-domain
    maxAge: 7 * 24 * 60 * 60 * 1000,
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

// ✅ Root route (for testing server health)
app.get('/', (req, res) => {
  res.send('Server working 🚀')
})

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

// Prevent crash
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})
