import { useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import LandingNav from '../components/layout/LandingNav'
import {
  Bot, Zap, Shield, BarChart3, MessageSquare, Database,
  ArrowRight, CheckCircle, FileText, Sparkles, Star
} from 'lucide-react'

const features = [
  {
    icon: Bot,
    title: 'AI-Powered Answers',
    desc: 'GPT-4o with retrieval augmented generation for accurate, context-aware support responses.',
    gradient: 'from-brand-500 to-brand-600',
    glow: 'rgba(99,102,241,0.3)',
  },
  {
    icon: Database,
    title: 'Knowledge Bases',
    desc: 'Upload PDF and TXT documents. Auto-chunked and vectorized for deep semantic search.',
    gradient: 'from-purple-500 to-purple-600',
    glow: 'rgba(168,85,247,0.3)',
  },
  {
    icon: MessageSquare,
    title: 'Real-time Streaming',
    desc: 'Answers stream word-by-word with source citations and intelligent follow-up suggestions.',
    gradient: 'from-pink-500 to-rose-500',
    glow: 'rgba(236,72,153,0.3)',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    desc: 'Full visibility into usage, documents, chats, and user activity across all knowledge bases.',
    gradient: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.3)',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'Google OAuth, session-based authentication, and encrypted data storage at rest.',
    gradient: 'from-amber-400 to-orange-500',
    glow: 'rgba(245,158,11,0.3)',
  },
  {
    icon: Zap,
    title: 'RAG Pipeline',
    desc: 'pgvector cosine similarity search across all your documents at production scale.',
    gradient: 'from-cyan-500 to-blue-500',
    glow: 'rgba(6,182,212,0.3)',
  },
]

const perks = [
  'No hallucinations — grounded in your documents',
  'Drag & drop PDF / TXT upload with preview',
  'Chat history saved and searchable',
  'Source citation with every answer',
  'Admin dashboard for full oversight',
  'Dark / light mode with smooth transitions',
]

const mockLogs = [
  ['→', 'Uploading product-manual.pdf', 'text-brand-400'],
  ['✓', 'Extracted 12,458 tokens', 'text-emerald-400'],
  ['→', 'Splitting into 28 chunks (500 tok)', 'text-brand-400'],
  ['✓', 'Generated 28 embeddings', 'text-emerald-400'],
  ['✓', 'Stored in pgvector', 'text-emerald-400'],
  ['→', 'Query: "warranty period?"', 'text-purple-400'],
  ['✓', 'Found 5 relevant chunks (cos sim)', 'text-emerald-400'],
  ['✓', 'Response streaming…', 'text-amber-400'],
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

function FeatureCard({ icon: Icon, title, desc, gradient, glow, index }) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="relative group card-hover p-6 overflow-hidden cursor-default"
    >
      {/* glow shimmer on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glow} 0%, transparent 70%)` }}
      />
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg`}
           style={{ boxShadow: `0 4px 16px ${glow}` }}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="font-semibold text-surface-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-surface-500 dark:text-surface-400 leading-relaxed">{desc}</p>
    </motion.div>
  )
}

export default function LandingPage() {
  const { login } = useAuth()
  const featuresRef = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' })

  return (
    <div className="min-h-screen overflow-x-hidden">
      <LandingNav />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-28 px-6 overflow-hidden">
        {/* Background mesh */}
        <div className="absolute inset-0 mesh-bg pointer-events-none" />
        <div className="glow-bg absolute inset-0 pointer-events-none" />

        {/* Floating orbs */}
        <motion.div
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-32 left-[10%] w-64 h-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ y: [0, 20, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-48 right-[10%] w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"
        />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                       bg-brand-50 dark:bg-brand-950/60
                       border border-brand-200 dark:border-brand-700/60
                       text-brand-700 dark:text-brand-300 text-sm font-medium mb-8
                       shadow-[0_0_20px_rgba(99,102,241,0.15)]"
          >
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            Powered by GPT-4o + pgvector
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight"
          >
            Your AI Customer
            <br />
            <span className="gradient-text">Support Agent</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="text-lg md:text-xl text-surface-600 dark:text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Upload your documentation, policies, or knowledge articles.
            Let AI answer customer questions — instantly, accurately, with sources.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button onClick={login} className="btn-primary text-base px-8 py-3.5 group">
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#features" className="btn-secondary text-base px-8 py-3.5">
              See how it works
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="flex items-center justify-center gap-6 mt-10 text-sm text-surface-500"
          >
            <div className="flex items-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-1">5.0 rating</span>
            </div>
            <span className="w-px h-4 bg-surface-300 dark:bg-surface-700" />
            <span>No credit card required</span>
            <span className="w-px h-4 bg-surface-300 dark:bg-surface-700" />
            <span>Free to start</span>
          </motion.div>
        </div>

        {/* Animated Mock Chat */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9 }}
          className="max-w-lg mx-auto mt-20 relative"
        >
          {/* Glow behind card */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-500/20 to-purple-500/20 blur-2xl -z-10" />

          <div className="card p-5">
            {/* Chat header */}
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-surface-100 dark:border-surface-800">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.4)]">
                <Bot className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">AI Support Agent</p>
                <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online · Ready to help
                </p>
              </div>
              <div className="ml-auto flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              </div>
            </div>

            <div className="space-y-4">
              {/* User message */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9, duration: 0.4 }}
                className="flex justify-end"
              >
                <div className="chat-bubble-user">What's your refund policy?</div>
              </motion.div>

              {/* AI response */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                className="space-y-2"
              >
                <div className="chat-bubble-ai w-fit">
                  Based on your documentation, you offer a <strong>30-day full refund</strong> on all purchases. No questions asked. Returns are processed within 3–5 business days.
                </div>
                <div className="flex items-center gap-1.5 ml-1">
                  <div className="badge-brand text-xs">
                    <FileText className="w-3 h-3" />
                    refund-policy.pdf
                  </div>
                </div>
              </motion.div>

              {/* Typing indicator shimmer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ delay: 1.7, duration: 2, repeat: Infinity, repeatDelay: 4 }}
                className="flex gap-3 items-end"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="chat-bubble-ai w-fit flex gap-1.5 py-3.5">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="features" ref={featuresRef} className="py-28 px-6 relative">
        <div className="absolute inset-0 bg-surface-50/50 dark:bg-surface-900/30 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-xs font-semibold uppercase tracking-wide mb-4">
              Everything you need
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
              Built for real <span className="gradient-text-blue">support teams</span>
            </h2>
            <p className="text-surface-500 dark:text-surface-400 max-w-xl mx-auto text-lg">
              A complete RAG-powered support platform built on modern, battle-tested infrastructure.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={featuresInView ? 'visible' : 'hidden'}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map(f => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Perks + Pipeline Log ── */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-5">
              Why choose us
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight tracking-tight">
              Everything your team <span className="gradient-text">needs to ship</span>
            </h2>
            <div className="space-y-3.5">
              {perks.map((p, i) => (
                <motion.div
                  key={p}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{p}</span>
                </motion.div>
              ))}
            </div>
            <button onClick={login} className="btn-primary mt-8 text-base px-6 py-3">
              Start for free <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Pipeline log card */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="card p-5 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-purple-500/5 pointer-events-none" />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs text-surface-400 font-mono">rag-pipeline.log</span>
            </div>
            <div className="space-y-2.5">
              {mockLogs.map(([sym, text, cls], i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                  className={`font-mono text-xs flex gap-2.5 ${cls}`}
                >
                  <span className="shrink-0">{sym}</span>
                  <span>{text}</span>
                </motion.div>
              ))}
              <motion.div
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="font-mono text-xs text-brand-400 flex gap-2.5"
              >
                <span>▊</span>
                <span>_</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-purple-600 to-pink-600" />
        <div className="absolute inset-0 mesh-bg opacity-40" />

        {/* Floating orbs in CTA */}
        <div className="absolute top-10 left-[15%] w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-10 right-[15%] w-64 h-64 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight"
          >
            Ready to build smarter support?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-white/80 text-lg mb-10 max-w-lg mx-auto"
          >
            Sign in with Google and create your first knowledge base in minutes. No setup required.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={login}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
                       bg-white text-brand-700 font-bold text-base
                       hover:bg-white/95
                       shadow-[0_8px_32px_rgba(0,0,0,0.2)]
                       hover:shadow-[0_16px_48px_rgba(0,0,0,0.3)]
                       transition-all duration-200"
          >
            <Sparkles className="w-4 h-4" />
            Get started now
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-surface-400 border-t border-surface-200 dark:border-surface-800">
        © {new Date().getFullYear()} AI Support Agent.
        Built with <span className="text-pink-500">♥</span> using GPT-4o + pgvector.
      </footer>
    </div>
  )
}
