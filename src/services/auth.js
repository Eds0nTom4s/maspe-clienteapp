import api from './api'

const TOKEN_KEY = 'authToken'

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

  isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY)
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  }
}
