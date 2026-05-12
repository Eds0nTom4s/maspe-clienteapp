import axios from 'axios'
import router from '../router'

// Em desenvolvimento, /api passa pelo proxy Vite para o backend Docker.
const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor de REQUEST: injeta o token em todas as chamadas
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor de RESPONSE: trata erros globais (401, 500...)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Token expirado ou inválido → ir para login
        localStorage.removeItem('authToken')
        router.push('/login')
      }
    }
    return Promise.reject(error)
  }
)

export default api
