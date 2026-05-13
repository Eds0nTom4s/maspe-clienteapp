import api from './api'

const TOKEN_KEY = 'authToken'

/**
 * Descodifica o payload de um JWT sem validar a assinatura.
 * Serve para verificar a expiração no lado do cliente.
 */
export function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export const AuthService = {

  // POST /api/auth/solicitar-otp
  async requestOtp(phoneNumber) {
    try {
      const response = await api.post('/auth/solicitar-otp', { telefone: phoneNumber })
      return response.data
    } catch (error) {
      console.error('Failed to request OTP:', error)
      throw error
    }
  },

  // POST /api/auth/validar-otp
  async validateOtp(phoneNumber, otpCode) {
    try {
      const response = await api.post('/auth/validar-otp', {
        telefone: phoneNumber,
        codigo: otpCode
      })

      // Token gets returned in response.data.data.accessToken based on the backend guide
      const token = response.data?.data?.accessToken

      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
        return response.data?.data // Retorna o objecto AuthResponse completo
      }
      return null
    } catch (error) {
      console.error('Failed to validate OTP:', error)
      throw error
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
  },

  /**
   * Verifica se o token existe E se ainda não expirou.
   * Evita que o router guard deixe passar utilizadores com tokens expirados.
   */
  isAuthenticated() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return false
    if (this.isTokenExpired(token)) {
      // Limpa automaticamente o token inválido
      localStorage.removeItem(TOKEN_KEY)
      return false
    }
    return true
  },

  /**
   * Retorna true se o token JWT já expirou (comparação com clock do cliente).
   * Usa uma margem de 30s para compensar desvios de relógio.
   */
  isTokenExpired(token) {
    const payload = decodeJwtPayload(token)
    if (!payload || !payload.exp) return true
    const nowInSeconds = Math.floor(Date.now() / 1000)
    const CLOCK_SKEW_SECONDS = 30
    return payload.exp < nowInSeconds - CLOCK_SKEW_SECONDS
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  }
}
