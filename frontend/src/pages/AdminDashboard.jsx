import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, FileText, MessageSquare, Database, Shield, TrendingUp, Activity } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { TableSkeleton } from '../components/ui/Skeleton'
import api from '../lib/api'
import { formatDate, formatRelative } from '../lib/utils'

const statDefs = [
  { label: 'Total Users',    key: 'total_users',    icon: Users,         iconClass: 'stat-icon-indigo' },
  { label: 'Knowledge Bases',key: 'total_kbs',      icon: Database,      iconClass: 'stat-icon-purple' },
  { label: 'Documents',      key: 'total_docs',     icon: FileText,      iconClass: 'stat-icon-amber' },
  { label: 'Total Chunks',   key: 'total_chunks',   icon: Activity,      iconClass: 'stat-icon-emerald' },
  { label: 'Total Chats',    key: 'total_chats',    icon: MessageSquare, iconClass: 'stat-icon-indigo' },
  { label: 'Total Messages', key: 'total_messages', icon: TrendingUp,    iconClass: 'stat-icon-purple' },
]

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  })

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.4)]">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-surface-500">Platform-wide analytics and user management</p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statDefs.map(({ label, key, icon: Icon, iconClass }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
                <div className={iconClass}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-surface-900 dark:text-white tabular-nums">
                {(stats?.[key] ?? 0).toLocaleString()}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-surface-200/60 dark:border-surface-700/40">
            <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" />
              All Users
              <span className="text-surface-400 font-normal text-sm">({users.length})</span>
            </h2>
          </div>
          {usersLoading ? (
            <div className="p-4"><TableSkeleton rows={5} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-100 dark:border-surface-800/60">
                    {['User', 'Email', 'Role', 'KBs', 'Docs', 'Joined'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide px-5 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-surface-50 dark:border-surface-800/40
                                 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full ring-1 ring-brand-300/30" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                              {u.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-surface-500">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={u.role === 'admin' ? 'badge-brand' : 'badge bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-surface-500 tabular-nums">{u.kb_count ?? 0}</td>
                      <td className="px-5 py-3.5 text-sm text-surface-500 tabular-nums">{u.doc_count ?? 0}</td>
                      <td className="px-5 py-3.5 text-sm text-surface-500">{formatRelative(u.created_at)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-sm text-surface-500">No users found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
