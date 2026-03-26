import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useSessionStore = defineStore('session', () => {
  const isActive = ref(false)
  const balance = ref(0)
  const tableNumber = ref(null)
  const sessionId = ref(null)
  const qrCodeSessao = ref(null)
  const fundoId = ref(null)
  const localName = ref('Sabor de Luanda') // This could be fetched too
  
  const isLoading = ref(false)
  
  function setSession(sessao) {
    if (sessao && sessao.qrCodeSessao) {
      isActive.value = true
      sessionId.value = sessao.sessaoId
      qrCodeSessao.value = sessao.qrCodeSessao
      balance.value = sessao.saldoFundo || 0
      tableNumber.value = sessao.referenciaMesa || ''
    }
  }

  // POST /sessoes-consumo/cliente/iniciar-sessao/qr/{token}
  async function openSessionFromQR(qrToken) {
    isLoading.value = true
    try {
      const { data } = await api.post(`/sessoes-consumo/cliente/iniciar-sessao/qr/${qrToken}`)
      
      const sessao = data.data
      if (sessao && (sessao.status === 'ABERTA' || sessao.status === 'AGUARDANDO_PAGAMENTO')) {
        isActive.value = true
        sessionId.value = sessao.id
        balance.value = sessao.saldoFundo || 0
        tableNumber.value = sessao.referenciaMesa || 'Desconhecida'
        qrCodeSessao.value = sessao.qrCodeSessao || qrToken
        fundoId.value = sessao.fundoId
      } else {
        isActive.value = false
      }
      
      return data
    } catch (error) {
      console.error('Failed to open session from QR', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // GET /sessoes-consumo/cliente/minha-sessao
  async function fetchCurrentSession() {
    isLoading.value = true
    try {
      const { data } = await api.get('/sessoes-consumo/cliente/minha-sessao')
      
      const sessao = data.data
      if (sessao && (sessao.status === 'ABERTA' || sessao.status === 'AGUARDANDO_PAGAMENTO')) {
        isActive.value = true
        sessionId.value = sessao.id
        balance.value = sessao.saldoFundo || 0
        tableNumber.value = sessao.referenciaMesa
        qrCodeSessao.value = sessao.qrCodeSessao
        fundoId.value = sessao.fundoId
        return data
      }
    } catch (error) {
      // If 404, there's no active session, which is fine
      console.info('No active session found')
    } finally {
      isLoading.value = false
    }
  }

  // POST /api/financeiro/pagamento/recarga-sessao-ativa
  async function rechargeFundClient(amount) {
    isLoading.value = true
    try {
      const formData = new URLSearchParams()
      // Só incluir fundoId se estiver disponível — o backend resolve-o automaticamente se omitido
      if (fundoId.value) {
        formData.append('fundoId', fundoId.value)
      }
      formData.append('valor', amount)
      formData.append('metodo', 'MULTICAIXA_EXPRESS')
      
      const { data } = await api.post('/financeiro/pagamento/recarga-sessao-ativa', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      
      if (data && data.success) {
        // Como o pagamento no gateway real é assíncrono (aguarda SMS/Push no telefone do cliente)
        // Por agora, assumimos que o mock callback será rápido. Faremos um fetch secundário após uns segundos.
        setTimeout(() => fetchCurrentSession(), 5000)
        
        return { 
          message: 'Solicitação enviada. Confirme o pagamento no seu telemóvel (Multicaixa Express).',
          success: true
        }
      }
      throw new Error('Formato de resposta inesperado do servidor')
    } catch (error) {
      console.error('Falha na recarga do fundo:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, isActive, balance, tableNumber, sessionId, fundoId, qrCodeSessao, localName, openSessionFromQR, fetchCurrentSession, rechargeFundClient, setSession }
})
