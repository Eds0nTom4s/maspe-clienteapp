import api from './api'

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
        localStorage.setItem('token', token)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to validate OTP:', error)
      throw error
    }
  },

  logout() {
    localStorage.removeItem('token')
  },

  isAuthenticated() {
    return !!localStorage.getItem('token')
  }
}
