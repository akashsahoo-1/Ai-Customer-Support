import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, LayoutDashboard, MessageSquare, Database,
  Shield, Sun, Moon, LogOut, ChevronLeft, Menu,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { getInitials } from '../../lib/utils'

const navLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
]
const adminLinks = [
  { to: '/admin', icon: Shield, label: 'Admin' },
]

export default function Sidebar({ kbName = null, kbId = null }) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const location = useLocation()

  // Auto-close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const SidebarContent = ({ mobile = false }) => (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-16 border-b border-surface-200/60 dark:border-surface-700/40 shrink-0 ${!mobile && collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                        flex items-center justify-center shrink-0
                        shadow-[0_4px_12px_rgba(99,102,241,0.4)]">
          <Bot className="w-4 h-4 text-white" />
        </div>
        {(mobile || !collapsed) && (
          <motion.span
            initial={mobile ? {} : { opacity: 0 }}
            animate={mobile ? {} : { opacity: 1 }}
            className="font-bold text-surface-900 dark:text-white text-sm whitespace-nowrap flex-1"
          >
            AI Support
          </motion.span>
        )}
        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800
                       text-surface-500 ml-auto shrink-0 transition-colors"
          >
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto p-1.5 text-surface-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {navLinks.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              title={!mobile && collapsed ? label : undefined}
              className={active ? 'sidebar-link-active' : 'sidebar-link'}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(mobile || !collapsed) && <span className="truncate text-sm">{label}</span>}
            </Link>
          )
        })}

        {kbId && (
          <>
            <div className="pt-4 pb-1">
              {(mobile || !collapsed) && (
                <p className="text-xs font-semibold text-surface-400 dark:text-surface-600 px-3 uppercase tracking-wider truncate">
                  {kbName || 'Knowledge Base'}
                </p>
              )}
              {!mobile && collapsed && <div className="h-px w-4 mx-auto bg-surface-300 dark:bg-surface-700" />}
            </div>
            <Link
              to={`/kb/${kbId}`}
              className={location.pathname === `/kb/${kbId}` ? 'sidebar-link-active' : 'sidebar-link'}
              title={!mobile && collapsed ? 'Documents' : undefined}
            >
              <Database className="w-4 h-4 shrink-0" />
              {(mobile || !collapsed) && <span className="truncate text-sm">Documents</span>}
            </Link>
            <Link
              to={`/kb/${kbId}/chat`}
              className={location.pathname.startsWith(`/kb/${kbId}/chat`) ? 'sidebar-link-active' : 'sidebar-link'}
              title={!mobile && collapsed ? 'Chat' : undefined}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              {(mobile || !collapsed) && <span className="truncate text-sm">Chat</span>}
            </Link>
          </>
        )}

        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-1">
              {(mobile || !collapsed) && (
                <p className="text-xs font-semibold text-surface-400 dark:text-surface-600 px-3 uppercase tracking-wider">Admin</p>
              )}
            </div>
            {adminLinks.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={location.pathname === to ? 'sidebar-link-active' : 'sidebar-link'}
                title={!mobile && collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {(mobile || !collapsed) && <span className="truncate text-sm">{label}</span>}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-surface-200/60 dark:border-surface-700/40 space-y-0.5">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          className="sidebar-link w-full"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25 }}
              className="w-4 h-4 shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.div>
          </AnimatePresence>
          {(mobile || !collapsed) && (
            <span className="text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          )}
        </button>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(s => !s)}
            className="sidebar-link w-full"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full shrink-0 ring-1 ring-brand-300/50" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600
                              flex items-center justify-center text-white text-xs font-bold shrink-0">
                {getInitials(user?.name)}
              </div>
            )}
            {(mobile || !collapsed) && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{user?.name}</p>
              </div>
            )}
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 right-0 mb-2 card p-1 shadow-xl z-50"
              >
                <div className="px-3 py-2 border-b border-surface-100 dark:border-surface-800 mb-1">
                  <p className="text-xs text-surface-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                             text-red-600 dark:text-red-400
                             hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex flex-col h-screen
                   bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl
                   border-r border-surface-200/60 dark:border-surface-700/40
                   overflow-hidden shrink-0 fixed left-0 top-0 z-30"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-xl
                   bg-white/90 dark:bg-surface-900/90 backdrop-blur-md
                   border border-surface-200 dark:border-surface-700
                   shadow-lg text-surface-700 dark:text-surface-300"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col
                         bg-white dark:bg-surface-900
                         border-r border-surface-200 dark:border-surface-700"
            >
              <SidebarContent mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
