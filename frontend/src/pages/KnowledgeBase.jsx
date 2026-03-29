import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Trash2, MessageSquare, ArrowRight, Loader2,
  Calendar, HardDrive, Upload, Database, Sparkles
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import FileUpload from '../components/documents/FileUpload'
import { TableSkeleton } from '../components/ui/Skeleton'
import api from '../lib/api'
import { formatDate, formatFileSize, formatRelative } from '../lib/utils'
import toast from 'react-hot-toast'

export default function KnowledgeBase() {
  const { id: kbId } = useParams()
  const qc = useQueryClient()

  const { data: kb } = useQuery({
    queryKey: ['kb', kbId],
    queryFn: () => api.get(`/knowledge-bases/${kbId}`).then(r => r.data),
  })

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['docs', kbId],
    queryFn: () => api.get(`/documents?kbId=${kbId}`).then(r => r.data),
  })

  const { data: chats = [] } = useQuery({
    queryKey: ['chats', kbId],
    queryFn: () => api.get(`/chats?kbId=${kbId}`).then(r => r.data),
  })

  const deleteDoc = useMutation({
    mutationFn: docId => api.delete(`/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs', kbId] })
      toast.success('Document deleted')
    },
    onError: () => toast.error('Failed to delete document'),
  })

  function getFileTypeLabel(fileName = '') {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return { label: 'PDF', cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800' }
    return { label: 'TXT', cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800' }
  }

  return (
    <AppLayout kbName={kb?.name} kbId={kbId}>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
                <Database className="w-4.5 h-4.5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">
                {kb?.name ?? 'Knowledge Base'}
              </h1>
            </div>
            <p className="text-sm text-surface-500 ml-12">Upload documents and manage your knowledge base</p>
          </div>
          <Link to={`/kb/${kbId}/chat`} className="btn-primary shrink-0">
            <MessageSquare className="w-4 h-4" />
            Open Chat
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Upload panel ── */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-6">
              <h2 className="font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-950/60 flex items-center justify-center">
                  <Upload className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                </div>
                Upload Documents
              </h2>
              <FileUpload
                kbId={kbId}
                onSuccess={() => qc.invalidateQueries({ queryKey: ['docs', kbId] })}
              />
            </div>
          </div>

          {/* ── Documents list ── */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-surface-200/60 dark:border-surface-700/40">
                <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-500" />
                  Documents
                  <span className="text-surface-400 font-normal text-sm">({docs.length})</span>
                </h2>
                {docs.length > 0 && (
                  <span className="badge-brand">{docs.reduce((a, d) => a + (d.chunk_count ?? 0), 0)} chunks</span>
                )}
              </div>

              {isLoading ? (
                <div className="p-5"><TableSkeleton rows={4} /></div>
              ) : docs.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-7 h-7 text-surface-300 dark:text-surface-600" />
                  </div>
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">No documents yet</p>
                  <p className="text-xs text-surface-400">Upload a PDF or TXT file to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-100/60 dark:divide-surface-700/40">
                  <AnimatePresence>
                    {docs.map((doc, i) => {
                      const { label, cls } = getFileTypeLabel(doc.file_name)
                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-4 p-4 group hover:bg-surface-50/80 dark:hover:bg-surface-800/40 transition-colors"
                        >
                          {/* Type badge */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-xs font-bold ${cls}`}>
                            {label}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {formatFileSize(doc.file_size)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(doc.created_at)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="badge-brand text-xs">{doc.chunk_count ?? 0} chunks</span>
                            <button
                              id={`delete-doc-${doc.id}`}
                              onClick={() => {
                                if (confirm('Delete this document and all its chunks?')) {
                                  deleteDoc.mutate(doc.id)
                                }
                              }}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-red-500
                                         hover:bg-red-50 dark:hover:bg-red-950/30
                                         transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* ── Recent Chats ── */}
            {chats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="card overflow-hidden"
              >
                <div className="p-5 border-b border-surface-200/60 dark:border-surface-700/40">
                  <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                    Recent Chats
                  </h2>
                </div>
                <div className="divide-y divide-surface-100/60 dark:divide-surface-700/40">
                  {chats.slice(0, 5).map(chat => (
                    <Link
                      key={chat.id}
                      to={`/kb/${kbId}/chat/${chat.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                          {chat.first_message || 'New conversation'}
                        </p>
                        <p className="text-xs text-surface-500">
                          {formatRelative(chat.created_at)} · {chat.message_count ?? 0} messages
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
