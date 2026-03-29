import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, X, CheckCircle, AlertCircle, Loader2,
  File
} from 'lucide-react'
import api from '../../lib/api'
import { formatFileSize } from '../../lib/utils'
import toast from 'react-hot-toast'

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
}

function FileTypeIcon({ type, className = 'w-6 h-6' }) {
  if (type === 'application/pdf') {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 ${className}`}>
        <span className="text-red-600 dark:text-red-400 font-bold text-xs">PDF</span>
      </div>
    )
  }
  return (
    <div className={`flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 ${className}`}>
      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">TXT</span>
    </div>
  )
}

/* Preview card shown BEFORE user confirms upload */
function FilePreviewCard({ item, onUpload, onRemove }) {
  const { file, status, progress, error } = item
  const isPending = status === 'pending'
  const isUploading = status === 'uploading'
  const isDone = status === 'done'
  const isError = status === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 16, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="relative flex gap-3 p-3.5 rounded-xl
                 bg-surface-50 dark:bg-surface-800/60
                 border border-surface-200 dark:border-surface-700/60
                 group hover:border-brand-300 dark:hover:border-brand-700 transition-all"
    >
      {/* File type badge */}
      <FileTypeIcon type={file.type} className="w-10 h-10 shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-surface-500">{formatFileSize(file.size)}</p>
          {isError && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Progress bar */}
        {isUploading && (
          <div className="mt-2 w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full"
            />
          </div>
        )}
      </div>

      {/* Status / actions */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        {isDone && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Done
          </span>
        )}
        {isError && (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        )}
        {isUploading && (
          <span className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress}%
          </span>
        )}

        {isPending && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpload(item.id)}
              className="text-xs px-2.5 py-1 rounded-lg
                         bg-brand-600 hover:bg-brand-500 text-white font-medium
                         transition-colors shadow-sm"
            >
              Upload
            </button>
            <button
              onClick={() => onRemove(item.id)}
              className="p-1 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700
                         text-surface-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function FileUpload({ kbId, onSuccess }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(accepted => {
    const items = accepted.map(f => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      status: 'pending',
      progress: 0,
      error: null,
    }))
    setFiles(prev => [...prev, ...items])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  })

  async function uploadFile(id) {
    const item = files.find(f => f.id === id)
    if (!item || item.status !== 'pending') return

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'uploading', progress: 10 } : f))
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('kbId', kbId)

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => {
          const pct = Math.round((e.loaded * 80) / e.total)
          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 10 + pct } : f))
        },
      })
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', progress: 100 } : f))
      toast.success(`${item.file.name} uploaded!`)
      onSuccess?.()
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed'
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: msg } : f))
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function uploadAll() {
    const pending = files.filter(f => f.status === 'pending')
    if (pending.length === 0) return
    for (const item of pending) {
      await uploadFile(item.id)
    }
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const pendingCount = files.filter(f => f.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                    transition-all duration-300 group outline-none
                    ${isDragActive
            ? 'border-brand-500 bg-brand-50/80 dark:bg-brand-950/30 scale-[1.02]'
            : 'border-surface-300 dark:border-surface-700 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-surface-50 dark:hover:bg-surface-800/40'
          }`}
      >
        <input {...getInputProps()} />

        {/* Animated glow on drag */}
        {isDragActive && (
          <div className="absolute inset-0 rounded-2xl bg-brand-500/10 animate-pulse pointer-events-none" />
        )}

        <motion.div
          animate={isDragActive ? { scale: 1.08 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-3"
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
                          ${isDragActive
              ? 'bg-brand-500 shadow-[0_0_24px_rgba(99,102,241,0.5)]'
              : 'bg-surface-100 dark:bg-surface-800 group-hover:bg-brand-100 dark:group-hover:bg-brand-950/40'
            }`}>
            <Upload className={`w-6 h-6 transition-colors duration-300
                               ${isDragActive ? 'text-white' : 'text-surface-400 group-hover:text-brand-500'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              {isDragActive ? '🎯 Drop files here!' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-surface-500 mt-1">
              or <span className="text-brand-600 dark:text-brand-400 font-semibold">browse</span>
              {' '}— PDF and TXT supported
            </p>
          </div>
        </motion.div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map(item => (
              <FilePreviewCard
                key={item.id}
                item={item}
                onUpload={uploadFile}
                onRemove={removeFile}
              />
            ))}

            {/* Upload all button */}
            {pendingCount > 1 && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={uploadAll}
                disabled={uploading}
                className="btn-primary w-full justify-center py-3 mt-1"
              >
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><Upload className="w-4 h-4" /> Upload all {pendingCount} files</>
                }
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
