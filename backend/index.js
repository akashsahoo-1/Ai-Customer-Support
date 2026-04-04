require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const session = require('express-session')
const passport = require('passport')

// ✅ IMPORT AUTH ROUTES
const authRoutes = require('./routes/auth')

const kbRoutes = require('./routes/knowledgeBases')
const docRoutes = require('./routes/documents')
const chatRoutes = require('./routes/chats')
const statsRoutes = require('./routes/stats')
const adminRoutes = require('./routes/admin')

const app = express()

app.set('trust proxy', 1)

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}))

// Body
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: true,
    sameSite: 'none',
  },
}))

// ✅ ENABLE PASSPORT
require('./config/passport')
app.use(passport.initialize())
app.use(passport.session())

// ✅ ENABLE AUTH ROUTES
app.use('/api/auth', authRoutes)

// Other routes
app.use('/api/knowledge-bases', kbRoutes)
app.use('/api/documents', docRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/admin', adminRoutes)

// Root test
app.get('/', (req, res) => {
  res.send('OK')
})

const PORT = process.env.PORT

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
})