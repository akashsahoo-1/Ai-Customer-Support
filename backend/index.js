require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const session = require('express-session')

// ❌ REMOVE passport for now
// const passport = require('passport')

const kbRoutes = require('./routes/knowledgeBases')
const docRoutes = require('./routes/documents')
const chatRoutes = require('./routes/chats')
const statsRoutes = require('./routes/stats')
const adminRoutes = require('./routes/admin')

const app = express()

app.set('trust proxy', 1)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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

// ❌ DISABLED passport completely
// require('./config/passport')
// app.use(passport.initialize())
// app.use(passport.session())

// ❌ DISABLED auth route
// app.use('/api/auth', authRoutes)

// ✅ KEEP other routes
app.use('/api/knowledge-bases', kbRoutes)
app.use('/api/documents', docRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/admin', adminRoutes)

// ✅ ROOT TEST
app.get('/', (req, res) => {
  res.send('OK')
})

const PORT = process.env.PORT

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
