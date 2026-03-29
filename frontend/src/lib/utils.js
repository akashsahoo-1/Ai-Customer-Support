import { formatDistanceToNow, format } from 'date-fns'

export function formatDate(date) {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatRelative(date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function truncate(str, n = 60) {
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
