import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingScreen from '../components/ui/LoadingScreen'

export default function AuthCallback() {
  const { refetch } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    refetch().then(() => navigate('/dashboard', { replace: true }))
  }, [])

  return <LoadingScreen />
}
