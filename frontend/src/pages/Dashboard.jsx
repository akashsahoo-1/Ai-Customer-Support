import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Plus, Database, MessageSquare, FileText, Trash2, ArrowRight,
  Loader2, Bot, TrendingUp, X, Sparkles, Clock
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { CardSkeleton } from '../components/ui/Skeleton'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { formatDate, getInitials } from '../lib/utils'
import toast from 'react-hot-toast'

/* ──── Create KB Modal ──── */
function CreateKBModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await onCreate(name.trim())
      setName('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="card p-7 w-full max-w-md relative z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.4)]">
                  <Database className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-bold text-lg text-surface-900 dark:text-white">New Knowledge Base</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Knowledge Base Name</label>
                <input
                  id="kb-name-input"
                  className="input"
                  placeholder="e.g. Product Documentation"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-surface-400 mt-1.5">Give it a clear name so you can find it later.</p>
              </div>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="btn-primary w-full justify-center py-3"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Knowledge Base
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ──── KB Card ──── */
function KBCard({ kb, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.93, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.93 }}
      transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      className="card-hover p-5 group relative overflow-hidden"
    >
      {/* Gradient shimmer on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />

      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                        flex items-center justify-center
                        shadow-[0_4px_16px_rgba(99,102,241,0.3)]">
          <Database className="w-5 h-5 text-white" />
        </div>
        <button
          onClick={() => onDelete(kb.id)}
          className="p-1.5 rounded-lg text-surface-400 hover:text-red-500
                     hover:bg-red-50 dark:hover:bg-red-950/30
                     transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <h3 className="font-semibold text-surface-900 dark:text-white mb-1 truncate">{kb.name}</h3>
      <p className="text-xs text-surface-400 mb-4 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        Created {formatDate(kb.created_at)}
      </p>

      <div className="flex items-center gap-4 text-xs text-surface-500 mb-5">
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-50 dark:bg-surface-800/60">
          <FileText className="w-3.5 h-3.5 text-brand-400" />
          {kb.document_count ?? 0} docs
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-50 dark:bg-surface-800/60">
          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
          {kb.chat_count ?? 0} chats
        </span>
      </div>

      <div className="flex gap-2">
        <Link
          to={`/kb/${kb.id}`}
          className="btn-secondary text-xs px-3 py-1.5 flex-1 justify-center"
        >
          <FileText className="w-3.5 h-3.5" />
          Documents
        </Link>
        <Link
          to={`/kb/${kb.id}/chat`}
          className="btn-primary text-xs px-3 py-1.5 flex-1 justify-center"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.div>
  )
}

/* ──── Stat Card ──── */
function StatCard({ label, value, icon: Icon, iconClass, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className="card p-5 group hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">{label}</p>
        <div className={iconClass}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-surface-900 dark:text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </motion.div>
  )
}

/* ──── Dashboard ──── */
export default function Dashboard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: kbs, isLoading } = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => api.get('/knowledge-bases').then(r => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => api.get('/stats/me').then(r => r.data),
  })

  const createKB = useMutation({
    mutationFn: name => api.post('/knowledge-bases', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-bases'] })
      toast.success('Knowledge base created!')
    },
    onError: () => toast.error('Failed to create knowledge base'),
  })

  const deleteKB = useMutation({
    mutationFn: id => api.delete(`/knowledge-bases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-bases'] })
      toast.success('Knowledge base deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const statCards = [
    { label: 'Knowledge Bases', value: stats?.kb_count ?? 0, icon: Database, iconClass: 'stat-icon-indigo', delay: 0 },
    { label: 'Documents', value: stats?.doc_count ?? 0, icon: FileText, iconClass: 'stat-icon-purple', delay: 0.07 },
    { label: 'Total Chats', value: stats?.chat_count ?? 0, icon: MessageSquare, iconClass: 'stat-icon-emerald', delay: 0.14 },
    { label: 'Messages Sent', value: stats?.message_count ?? 0, icon: TrendingUp, iconClass: 'stat-icon-amber', delay: 0.21 },
  ]

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full ring-2 ring-brand-300/50 dark:ring-brand-700/50 shadow-lg"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-purple-600
                              flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {getInitials(user?.name)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-surface-900 dark:text-white">
                Welcome back, {user?.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-surface-500">
                Manage your knowledge bases and AI chat agents
              </p>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            id="create-kb-btn"
            onClick={() => setCreateOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Knowledge Base
          </motion.button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* ── KB Section ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-lg text-surface-900 dark:text-white">Your Knowledge Bases</h2>
              <p className="text-sm text-surface-500 mt-0.5">{kbs?.length ?? 0} total</p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : kbs?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-16 text-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-purple-500/5 pointer-events-none" />
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20
                              flex items-center justify-center mx-auto mb-5
                              border border-brand-200/30 dark:border-brand-700/30">
                <Bot className="w-10 h-10 text-brand-500" />
              </div>
              <h3 className="font-bold text-xl text-surface-900 dark:text-white mb-2">No knowledge bases yet</h3>
              <p className="text-sm text-surface-500 mb-8 max-w-sm mx-auto">
                Create your first knowledge base, upload documents, and let AI answer your customers.
              </p>
              <button onClick={() => setCreateOpen(true)} className="btn-primary mx-auto">
                <Sparkles className="w-4 h-4" />
                Create Knowledge Base
              </button>
            </motion.div>
          ) : (
            <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {kbs?.map(kb => (
                  <KBCard
                    key={kb.id}
                    kb={kb}
                    onDelete={id => {
                      if (confirm('Delete this knowledge base and all its data?')) {
                        deleteKB.mutate(id)
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      <CreateKBModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={name => createKB.mutateAsync(name).then(() => { })}
      />
    </AppLayout>
  )
}
