import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
    // CSS variables for toast
    root.style.setProperty('--toast-bg', theme === 'dark' ? '#1e293b' : '#ffffff')
    root.style.setProperty('--toast-color', theme === 'dark' ? '#f1f5f9' : '#0f172a')
    root.style.setProperty('--toast-border', theme === 'dark' ? '#334155' : '#e2e8f0')
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
