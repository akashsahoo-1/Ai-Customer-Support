import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 glow-bg pointer-events-none" />

      {/* Logo icon with breathing animation */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          boxShadow: [
            '0 0 24px rgba(99,102,241,0.3)',
            '0 0 48px rgba(99,102,241,0.6)',
            '0 0 24px rgba(99,102,241,0.3)',
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mb-8"
      >
        <Bot className="w-8 h-8 text-white" />
      </motion.div>

      {/* Bouncing dots */}
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            className="w-2 h-2 rounded-full bg-gradient-to-br from-brand-500 to-purple-500"
          />
        ))}
      </div>
      <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">Loading AI Support…</p>
    </div>
  )
}
