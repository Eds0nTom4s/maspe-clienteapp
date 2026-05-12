import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useSessionStore = defineStore('session', () => {
  const savedSession = JSON.parse(sessionStorage.getItem('anonymousSession') || 'null')
  const isActive = ref(false)
  const balance = ref(0)
  const tableNumber = ref(null)
  const sessionId = ref(null)
  const qrCodeSessao = ref(null)
  const fundoId = ref(null)
  const anonymousMode = ref(false)
  const identifiedTable = ref(null)
  const localName = ref('Sabor de Luanda') // This could be fetched too
  
  const isLoading = ref(false)

  if (savedSession?.qrCodeSessao) {
    isActive.value = true
    anonymousMode.value = true
    sessionId.value = savedSession.sessionId
    qrCodeSessao.value = savedSession.qrCodeSessao
    balance.value = savedSession.balance || 0
    tableNumber.value = savedSession.tableNumber || ''
    fundoId.value = savedSession.fundoId
  }

  function persistAnonymousSession() {
    if (!anonymousMode.value || !qrCodeSessao.value) return
    sessionStorage.setItem('anonymousSession', JSON.stringify({
      sessionId: sessionId.value,
      qrCodeSessao: qrCodeSessao.value,
      balance: balance.value,
      tableNumber: tableNumber.value,
      fundoId: fundoId.value
    }))
  }
  
  function setSession(sessao) {
    if (sessao && sessao.qrCodeSessao) {
      isActive.value = true
      sessionId.value = sessao.sessaoId
      qrCodeSessao.value = sessao.qrCodeSessao
      balance.value = sessao.saldoFundo || 0
      tableNumber.value = sessao.referenciaMesa || ''
      persistAnonymousSession()
    }
  }

  async function identifyTable(code) {
    isLoading.value = true
    try {
      const normalizedCode = String(code || '').trim().toUpperCase()
      const { data } = await api.get(`/public/mesa/${encodeURIComponent(normalizedCode)}`)
      identifiedTable.value = data.data
      tableNumber.value = identifiedTable.value?.referencia || ''
      return identifiedTable.value
    } finally {
      isLoading.value = false
    }
  }

  function getTableAccessToken(fallbackToken = null) {
    return identifiedTable.value?.qrCode || fallbackToken
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
        anonymousMode.value = false
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

  async function openAnonymousSessionFromQR(qrToken) {
    isLoading.value = true
    try {
      const { data } = await api.post(`/public/consumo-anonimo/sessoes/qr/${qrToken}`)
      const sessao = data.data
      if (sessao && (sessao.status === 'ABERTA' || sessao.status === 'AGUARDANDO_PAGAMENTO')) {
        isActive.value = true
        anonymousMode.value = true
        sessionId.value = sessao.id
        balance.value = sessao.saldoFundo || 0
        tableNumber.value = sessao.referenciaMesa || 'Desconhecida'
        qrCodeSessao.value = sessao.qrCodeSessao
        fundoId.value = sessao.fundoId
        persistAnonymousSession()
      }
      return data
    } catch (error) {
      console.error('Failed to open anonymous session from QR', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // GET /sessoes-consumo/cliente/minha-sessao
  async function fetchCurrentSession() {
    isLoading.value = true
    try {
      const { data } = anonymousMode.value && qrCodeSessao.value
        ? await api.get(`/public/consumo-anonimo/sessoes/${qrCodeSessao.value}`)
        : await api.get('/sessoes-consumo/cliente/minha-sessao')
      
      const sessao = data.data
      if (sessao && (sessao.status === 'ABERTA' || sessao.status === 'AGUARDANDO_PAGAMENTO')) {
        isActive.value = true
        sessionId.value = sessao.id
        balance.value = sessao.saldoFundo || 0
        tableNumber.value = sessao.referenciaMesa
        qrCodeSessao.value = sessao.qrCodeSessao
        fundoId.value = sessao.fundoId
        persistAnonymousSession()
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
  async function rechargeFundClient(amount, metodo = 'GPO', telefone = null) {
    isLoading.value = true
    try {
      if (anonymousMode.value) {
        if (!fundoId.value) {
          throw new Error('Fundo anónimo não encontrado.')
        }
        const { data } = await api.post('/public/consumo-anonimo/pagamentos/recarregar', {
          fundoId: fundoId.value,
          valor: amount,
          metodo,
          telefone
        })
        setTimeout(() => fetchCurrentSession(), 5000)
        return {
          message: data.message || 'Recarga solicitada.',
          success: true,
          pagamento: data.data
        }
      }

      const formData = new URLSearchParams()
      // Só incluir fundoId se estiver disponível — o backend resolve-o automaticamente se omitido
      if (fundoId.value) {
        formData.append('fundoId', fundoId.value)
      }
      formData.append('valor', amount)
      formData.append('metodo', metodo)
      if (telefone) {
        formData.append('telefone', telefone)
      }
      
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

  return { isLoading, isActive, anonymousMode, balance, tableNumber, sessionId, fundoId, qrCodeSessao, identifiedTable, localName, identifyTable, getTableAccessToken, openSessionFromQR, openAnonymousSessionFromQR, fetchCurrentSession, rechargeFundClient, setSession }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSessionStore, import.meta.hot))
}
