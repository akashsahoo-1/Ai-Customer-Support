import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  // 60 s for PDF upload/processing; SSE chat streams handle their own timeout
  timeout: 60000,
  // NOTE: Do NOT set a global Content-Type here.
  // Axios sets it automatically per-request (multipart/form-data with boundary
  // for FormData, application/json for plain objects).
})

api.interceptors.response.use(
  res => res,
  err => Promise.reject(err)
)

export default api
