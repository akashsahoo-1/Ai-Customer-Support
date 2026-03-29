import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Bot, Sun, Moon, Sparkles, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function LandingNav() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6
                      backdrop-blur-xl bg-white/70 dark:bg-surface-950/80
                      border-b border-surface-200/40 dark:border-surface-800/50
                      shadow-[0_1px_24px_rgba(0,0,0,0.06)]">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center
                          shadow-[0_4px_12px_rgba(99,102,241,0.4)]">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-surface-900 dark:text-white tracking-tight">AI Support</span>
        </div>

        {/* Nav links (desktop) */}
        <div className="hidden md:flex items-center gap-1 ml-8">
          {['Features', 'Pricing', 'Docs'].map(link => (
            <a
              key={link}
              href={link === 'Features' ? '#features' : '#'}
              className="px-3 py-1.5 rounded-lg text-sm text-surface-600 dark:text-surface-400
                         hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800
                         transition-all duration-200"
            >
              {link}
            </a>
          ))}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800
                       text-surface-500 dark:text-surface-400 transition-all duration-200"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </motion.div>
            </AnimatePresence>
          </button>
          <button
            onClick={login}
            className="hidden md:flex btn-primary"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sign in
          </button>
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-16 inset-x-0 z-40 bg-white/95 dark:bg-surface-950/95 backdrop-blur-xl
                       border-b border-surface-200 dark:border-surface-800 p-4 space-y-1"
          >
            {['Features', 'Pricing', 'Docs'].map(link => (
              <a key={link} href={link === 'Features' ? '#features' : '#'}
                 onClick={() => setMobileOpen(false)}
                 className="block px-4 py-3 rounded-xl text-sm text-surface-700 dark:text-surface-300
                            hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                {link}
              </a>
            ))}
            <button onClick={login} className="btn-primary w-full justify-center mt-2">
              <Sparkles className="w-3.5 h-3.5" />
              Sign in with Google
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
