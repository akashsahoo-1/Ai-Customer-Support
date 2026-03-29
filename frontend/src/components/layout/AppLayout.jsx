import { motion } from 'framer-motion'
import Sidebar from './Sidebar'

export default function AppLayout({ children, kbName, kbId }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
      <Sidebar kbName={kbName} kbId={kbId} />
      <main className="flex-1 overflow-y-auto md:ml-60 transition-all duration-300">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="min-h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}

