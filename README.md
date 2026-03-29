# AI Customer Support Agent

A full-stack RAG-powered customer support agent built with React + Vite + Node.js + PostgreSQL + pgvector + GPT-4o.

## Tech Stack
- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **Backend**: Node.js + Express + Passport.js (Google OAuth)
- **Database**: PostgreSQL with pgvector extension
- **AI**: OpenAI GPT-4o (chat) + text-embedding-3-small (embeddings)
- **Auth**: Google OAuth 2.0 (session-based)

## Project Structure

```
ai-support/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/     # Sidebar, AppLayout, LandingNav
│   │   │   ├── ui/         # LoadingScreen, Skeleton
│   │   │   └── documents/  # FileUpload (drag & drop)
│   │   ├── context/        # AuthContext, ThemeContext
│   │   ├── lib/            # api.js (axios), utils.js
│   │   └── pages/
│   │       ├── LandingPage.jsx
│   │       ├── Dashboard.jsx
│   │       ├── KnowledgeBase.jsx
│   │       ├── ChatPage.jsx
│   │       ├── AdminDashboard.jsx
│   │       └── AuthCallback.jsx
└── backend/           # Express API
    ├── config/
    │   ├── db.js          # PostgreSQL pool
    │   └── passport.js    # Google OAuth strategy
    ├── middleware/
    │   └── auth.js        # requireAuth, requireAdmin
    ├── routes/
    │   ├── auth.js        # /api/auth/google, /api/auth/me
    │   ├── knowledgeBases.js
    │   ├── documents.js   # multer upload + RAG processing
    │   ├── chats.js       # SSE streaming endpoint
    │   ├── stats.js
    │   └── admin.js
    ├── services/
    │   └── rag.js         # extract → chunk → embed → store → search
    ├── scripts/
    │   └── initDb.js      # Run schema.sql
    └── schema.sql         # Full PostgreSQL schema
```

## Setup

### 1. Prerequisites
- Node.js >= 18
- PostgreSQL with pgvector extension
- Google Cloud Console project with OAuth credentials
- OpenAI API key

### 2. Database Setup (PostgreSQL + pgvector)

**Option A: Neon (recommended free tier)**
1. Create account at https://neon.tech
2. Create a new project (pgvector is pre-enabled)
3. Copy the connection string

**Option B: Local PostgreSQL**
```bash
# Install pgvector
psql -c "CREATE EXTENSION vector;"
```

**Run schema:**
```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL
npm run db:init
```

### 3. Google OAuth Setup
1. Go to https://console.cloud.google.com
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `http://localhost:5000/api/auth/google/callback` (dev)
   - `https://your-backend.railway.app/api/auth/google/callback` (prod)
4. Copy Client ID and Secret to `.env`

### 4. Environment Variables

**Backend** (`backend/.env`):
```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
SESSION_SECRET=your-random-secret
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Run Locally
```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (dev)
cd backend && npm run dev

# Start frontend (dev)
cd frontend && npm run dev
```

Open http://localhost:5173

## Features

### ✅ Feature 1: Google Auth
- Sign in with Google OAuth 2.0
- Session persisted in cookie (7 days)
- User info stored in `users` table

### ✅ Feature 2: User Dashboard
- Create multiple knowledge bases
- View stats (KBs, Docs, Chats, Messages)
- Delete knowledge bases
- See recent documents and chats

### ✅ Feature 3: Document Upload + RAG Pipeline
- Drag & drop PDF and TXT files
- Real-time upload progress
- Auto-extraction → chunking (500 tokens, 50 overlap) → embedding → pgvector storage
- Chunk count visible per document

### ✅ Feature 4: Chat with SSE Streaming
- Real-time typewriter effect via Server-Sent Events
- Source citations per response
- Follow-up suggestions after each answer
- Chat history sidebar
- Persistent history across sessions

### ✅ Feature 5: Admin Dashboard
- `/admin` route (admin role only)
- Platform-wide stats
- Full user table with usage metrics

## Deployment

### Frontend → Vercel
```bash
cd frontend
vercel --prod
```
Set env: `VITE_API_URL=https://your-backend.railway.app/api`

### Backend → Railway
1. Push `backend/` to GitHub
2. Connect to Railway
3. Set all env variables
4. Deploy

Update `GOOGLE_CALLBACK_URL` and `FRONTEND_URL` in production.

## Make a User Admin
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```
