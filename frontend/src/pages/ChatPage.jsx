import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, Loader2, FileText, Plus,
  Sparkles, MessageSquare, ChevronRight, Search, X,
  Database, ArrowRight
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { ChatSkeleton } from '../components/ui/Skeleton'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatRelative, getInitials } from '../lib/utils'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

/* ──── Typing Indicator (3 bouncing dots) ──── */
function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="chat-bubble-ai flex items-center gap-1.5 py-3.5 px-4 w-fit">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

/* ──── Message Bubble ──── */
function MessageBubble({ msg, user, onFollowUp }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5
                      ${isUser
                        ? 'bg-gradient-to-br from-brand-500 to-brand-700'
                        : 'bg-gradient-to-br from-brand-500 to-purple-600 shadow-[0_4px_12px_rgba(99,102,241,0.35)]'
                      }`}>
        {isUser
          ? (user?.avatar
              ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
              : <span className="text-white text-xs font-bold">{getInitials(user?.name)}</span>)
          : <Bot className="w-4 h-4 text-white" />
        }
      </div>

      <div className={`flex flex-col gap-2 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
          {/* Streaming cursor */}
          {msg.streaming && msg.content
            ? <>{msg.content}<motion.span animate={{ opacity: [1,0,1] }} transition={{ duration: 0.7, repeat: Infinity }} className="ml-0.5 inline-block w-0.5 h-4 bg-current align-middle" /></>
            : msg.content
          }
        </div>

        {/* Sources */}
        {!isUser && msg.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.sources.map((src, i) => (
              <span key={i} className="badge-brand text-xs">
                <FileText className="w-3 h-3" />
                {src.file_name}
              </span>
            ))}
          </div>
        )}

        {/* Follow-ups */}
        {!isUser && msg.follow_ups?.length > 0 && (
          <div className="space-y-1.5 w-full max-w-sm">
            <p className="text-xs text-surface-400 dark:text-surface-500 font-medium">Suggested questions:</p>
            {msg.follow_ups.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className="w-full text-left text-xs px-3 py-2 rounded-xl
                           bg-surface-50 dark:bg-surface-800/60
                           border border-surface-200 dark:border-surface-700
                           hover:border-brand-400 dark:hover:border-brand-600
                           hover:bg-brand-50 dark:hover:bg-brand-950/30
                           text-surface-600 dark:text-surface-400
                           hover:text-brand-700 dark:hover:text-brand-300
                           transition-all group flex items-center gap-1.5"
              >
                <ChevronRight className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ──── Chat Sidebar ──── */
function ChatSidebar({ chats, currentChatId, kbId, onNewChat, onSelectChat }) {
  const [search, setSearch] = useState('')

  const filtered = chats.filter(c =>
    !search || (c.first_message || '').toLowerCase().includes(search.toLowerCase())
  )

  function highlight(text, query) {
    if (!query || !text) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-brand-200 dark:bg-brand-800 text-brand-900 dark:text-brand-100 rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div className="w-60 flex flex-col bg-white/80 dark:bg-surface-900/80 backdrop-blur-sm
                    border-r border-surface-200/60 dark:border-surface-700/40 shrink-0 overflow-hidden">
      {/* New chat */}
      <div className="p-3 border-b border-surface-200/60 dark:border-surface-700/40">
        <button
          id="new-chat-btn"
          onClick={onNewChat}
          className="btn-secondary w-full justify-center text-xs py-2"
        >
          <Plus className="w-3.5 h-3.5" /> New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-surface-200/40 dark:border-surface-700/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full pl-7 pr-7 py-1.5 text-xs rounded-lg
                       bg-surface-100 dark:bg-surface-800
                       border border-surface-200 dark:border-surface-700
                       text-surface-700 dark:text-surface-300
                       placeholder-surface-400 focus:outline-none
                       focus:ring-1 focus:ring-brand-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <AnimatePresence>
          {filtered.length === 0 && search && (
            <p className="text-xs text-surface-400 text-center py-6">No chats found</p>
          )}
          {filtered.map(chat => (
            <motion.button
              key={chat.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => onSelectChat(chat.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${
                chat.id === currentChatId
                  ? 'sidebar-link-active'
                  : 'hover:bg-surface-100 dark:hover:bg-surface-800/60 text-surface-600 dark:text-surface-400'
              }`}
            >
              <p className="font-medium truncate">
                {highlight(chat.first_message || 'New conversation', search)}
              </p>
              <p className="text-surface-400 mt-0.5 text-[10px]">{formatRelative(chat.created_at)}</p>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ──── ChatPage ──── */
export default function ChatPage() {
  const { kbId, chatId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [isTyping, setIsTyping] = useState(false) // separate typing indicator state
  const [currentChatId, setCurrentChatId] = useState(chatId || null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  const { data: kb } = useQuery({
    queryKey: ['kb', kbId],
    queryFn: () => api.get(`/knowledge-bases/${kbId}`).then(r => r.data),
  })

  const { data: chatHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['chat-messages', currentChatId],
    queryFn: () => api.get(`/chats/${currentChatId}/messages`).then(r => r.data),
    enabled: !!currentChatId,
  })

  const { data: chats = [] } = useQuery({
    queryKey: ['chats', kbId],
    queryFn: () => api.get(`/chats?kbId=${kbId}`).then(r => r.data),
  })

  useEffect(() => {
    if (chatHistory) setMessages(chatHistory)
  }, [chatHistory])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming, isTyping])

  const sendMessage = useCallback(async (question) => {
    const q = question || input.trim()
    if (!q || streaming) return
    setInput('')

    const userMsg = { role: 'user', content: q, id: `u${Date.now()}` }
    setMessages(prev => [...prev, userMsg])

    // Show typing indicator before streaming
    setIsTyping(true)
    setStreaming(true)

    let chatId = currentChatId
    if (!chatId) {
      try {
        const res = await api.post('/chats', { kbId })
        chatId = res.data.id
        setCurrentChatId(chatId)
        navigate(`/kb/${kbId}/chat/${chatId}`, { replace: true })
        qc.invalidateQueries({ queryKey: ['chats', kbId] })
      } catch {
        toast.error('Failed to create chat')
        setStreaming(false)
        setIsTyping(false)
        return
      }
    }

    const aiMsgId = `a${Date.now()}`
    let firstToken = true

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch(`${API_URL}/chats/${chatId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        credentials: 'include',
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('Stream failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let sources = []
      let followUps = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'token') {
              // First token: hide typing indicator, show message bubble
              if (firstToken) {
                setIsTyping(false)
                firstToken = false
                setMessages(prev => [...prev, { role: 'assistant', content: '', id: aiMsgId, streaming: true }])
              }
              fullContent += parsed.content
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: fullContent } : m
              ))
            } else if (parsed.type === 'sources') {
              sources = parsed.sources
            } else if (parsed.type === 'follow_ups') {
              followUps = parsed.questions
            }
          } catch {}
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, streaming: false, sources, follow_ups: followUps }
          : m
      ))
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Failed to get response')
        setMessages(prev => prev.filter(m => m.id !== aiMsgId))
      }
    } finally {
      setStreaming(false)
      setIsTyping(false)
    }
  }, [input, streaming, currentChatId, kbId, navigate, qc])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function newChat() {
    setCurrentChatId(null)
    setMessages([])
    navigate(`/kb/${kbId}/chat`, { replace: true })
  }

  function selectChat(id) {
    setCurrentChatId(id)
    navigate(`/kb/${kbId}/chat/${id}`)
  }

  // Auto-resize textarea
  function handleInputChange(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
  }

  return (
    <AppLayout kbName={kb?.name} kbId={kbId}>
      <div className="flex h-screen overflow-hidden">
        {/* ── Chat History Sidebar ── */}
        <ChatSidebar
          chats={chats}
          currentChatId={currentChatId}
          kbId={kbId}
          onNewChat={newChat}
          onSelectChat={selectChat}
        />

        {/* ── Main Chat Area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-5
                          border-b border-surface-200/60 dark:border-surface-700/40
                          bg-white/80 dark:bg-surface-900/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                              flex items-center justify-center
                              shadow-[0_4px_12px_rgba(99,102,241,0.4)]">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">{kb?.name || 'AI Support'}</p>
                <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isTyping ? 'Thinking…' : 'Ready to answer'}
                </p>
              </div>
            </div>

            {/* KB name badge */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                              bg-brand-50 dark:bg-brand-950/50
                              border border-brand-200 dark:border-brand-700/50
                              text-brand-700 dark:text-brand-300 text-xs font-medium">
                <Database className="w-3 h-3" />
                {kb?.name || 'Knowledge Base'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
            {historyLoading ? (
              <ChatSkeleton />
            ) : messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center px-4"
              >
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20
                                   flex items-center justify-center
                                   border border-brand-200/30 dark:border-brand-700/30">
                    <Sparkles className="w-9 h-9 text-brand-500" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
                  Ask anything about {kb?.name}
                </h2>
                <p className="text-sm text-surface-500 max-w-sm mb-8 leading-relaxed">
                  I'll search through your uploaded documents and provide accurate answers with source citations.
                </p>

                {/* Suggested starters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                  {[
                    'What topics does this knowledge base cover?',
                    'Give me a summary of the main points',
                    'What are the key policies?',
                    'What questions can you answer?',
                  ].map((q, i) => (
                    <motion.button
                      key={q}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      onClick={() => sendMessage(q)}
                      className="text-left text-xs p-3.5 rounded-xl
                                 border border-surface-200 dark:border-surface-700
                                 hover:border-brand-400 dark:hover:border-brand-600
                                 hover:bg-brand-50 dark:hover:bg-brand-950/30
                                 text-surface-600 dark:text-surface-400
                                 hover:text-brand-700 dark:hover:text-brand-300
                                 transition-all group flex items-start gap-2"
                    >
                      <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                      {q}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <>
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    user={user}
                    onFollowUp={sendMessage}
                  />
                ))}
                {/* Typing indicator BEFORE first token */}
                {isTyping && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-surface-200/60 dark:border-surface-700/40
                          bg-white/80 dark:bg-surface-900/80 backdrop-blur-sm">
            <div className="flex gap-3 max-w-4xl mx-auto items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  id="chat-input"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your documents…"
                  rows={1}
                  style={{ resize: 'none', height: '48px' }}
                  className="input pr-4 py-3 min-h-[48px] max-h-32 overflow-y-auto
                             focus:ring-brand-500/50 leading-relaxed"
                />
              </div>
              <motion.button
                id="send-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
                className="btn-primary w-11 h-11 p-0 justify-center shrink-0"
              >
                {streaming
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
              </motion.button>
            </div>
            <p className="text-xs text-center text-surface-400 mt-2">
              Answers are grounded in your uploaded documents · <kbd className="px-1 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500 text-xs">Enter</kbd> to send
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
