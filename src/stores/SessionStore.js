import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'
import { AuthService, decodeJwtPayload } from '../services/auth'

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

  // O nome do restaurante será carregado por defeito como "Restaurante"
  const localName = ref('Restaurante')
  
  // Extrai nome do restaurante do JWT se existir (Fallback rápido)
  const token = AuthService.getToken()
  if (token) {
    const payload = decodeJwtPayload(token)
    if (payload?.instituicao) localName.value = payload.instituicao
  }

  // Lógica de cache da Instituição
  const CACHE_KEY = 'instituicaoData'
  const currentApiUrl = import.meta.env.VITE_API_URL || '/api'
  
  function carregarInstituicaoDoCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.baseUrl === currentApiUrl && parsed.nome) {
          localName.value = parsed.nome
          return parsed // Retorna o objeto cacheado para comparação
        }
      }
    } catch (e) {
      console.warn('Erro ao ler cache da instituição:', e)
    }
    return null
  }

  // Busca ativamente os dados públicos da Instituição usando Stale-While-Revalidate
  async function carregarInstituicao(forceRefresh = false) {
    const cachedData = carregarInstituicaoDoCache()
    
    // Se forceRefresh for falso e não tivermos cache, temos de esperar pela API (await opcional)
    // Se tivermos cache, a UI já mostra o valor antigo (stale), e fazemos a chamada em background
    try {
      const { data } = await api.get('/public/instituicao')
      if (data?.data?.nome) {
        // Atualiza a reatividade da App imediatamente se houver mudanças
        if (!cachedData || cachedData.nome !== data.data.nome || cachedData.sigla !== data.data.sigla) {
          localName.value = data.data.nome
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            baseUrl: currentApiUrl,
            nome: data.data.nome,
            sigla: data.data.sigla,
            urlLogo: data.data.urlLogo,
            timestamp: Date.now()
          }))
        }
      }
    } catch (e) {
      console.warn('Não foi possível sincronizar o nome da instituição via API em background.')
    }
  }

  // Invoca automaticamente no arranque (A UI arranca com Cache, a API atualiza por trás)
  carregarInstituicao()

  const isLoading = ref(false)
  let balanceSyncTimer = null
  // Flag para evitar polling quando WebSocket está activo (evita pedidos HTTP redundantes)
  let wsBalanceActive = ref(false)

  // Restaurar sessão anónima do sessionStorage — incluindo anonymousMode (Fix P1)
  if (savedSession?.qrCodeSessao) {
    isActive.value = true
    anonymousMode.value = true   // ← correcção: estava em falta, causava 401 após reload
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
      applySession(sessao)
    }
  }

  function applySession(sessao) {
    if (sessao && sessao.qrCodeSessao) {
      isActive.value = true
      sessionId.value = sessao.id || sessao.sessaoId
      qrCodeSessao.value = sessao.qrCodeSessao
      balance.value = sessao.saldoFundo || 0
      tableNumber.value = sessao.referenciaMesa || ''
      fundoId.value = sessao.fundoId || fundoId.value
      persistAnonymousSession()
    }
  }

  function setBalance(novoSaldo) {
    balance.value = Number(novoSaldo || 0)
    persistAnonymousSession()
  }

  /**
   * Indica ao store que o WebSocket de saldo está activo.
   * Quando true, o polling HTTP é suspenso para evitar redundância.
   */
  function setWsBalanceActive(active) {
    wsBalanceActive.value = active
    if (active) stopBalanceSync()
  }

  async function identifyTable(codigo) {
    isLoading.value = true
    try {
      const { data } = await api.get(`/public/mesa/${encodeURIComponent(codigo)}`)
      identifiedTable.value = data.data
      tableNumber.value = data.data.referencia || ''
      
      if (data.data.unidadeAtendimentoNome) {
        // Se escaneou uma mesa de um tenant/nome diferente do que temos em cache
        if (localName.value !== data.data.unidadeAtendimentoNome) {
          localName.value = data.data.unidadeAtendimentoNome
          // Forçamos o refresh para atualizar também o cache (logo, sigla, etc.)
          carregarInstituicao(true)
        }
      }
      return data.data
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
        applySession({
          ...sessao,
          qrCodeSessao: sessao.qrCodeSessao || qrToken,
          referenciaMesa: sessao.referenciaMesa || 'Desconhecida'
        })
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
        anonymousMode.value = true
        applySession({
          ...sessao,
          referenciaMesa: sessao.referenciaMesa || 'Desconhecida'
        })
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
  async function fetchCurrentSession(options = {}) {
    const silent = Boolean(options.silent)
    if (!silent) isLoading.value = true
    try {
      const { data } = anonymousMode.value && qrCodeSessao.value
        ? await api.get(`/public/consumo-anonimo/sessoes/${qrCodeSessao.value}`)
        : await api.get('/sessoes-consumo/cliente/minha-sessao')

      const sessao = data.data
      if (sessao && (sessao.status === 'ABERTA' || sessao.status === 'AGUARDANDO_PAGAMENTO')) {
        applySession(sessao)
        return data
      }
    } catch (error) {
      // Se 404, não existe sessão activa — é esperado
      console.info('No active session found')
    } finally {
      if (!silent) isLoading.value = false
    }
  }

  /**
   * Polling HTTP de saldo como fallback quando WebSocket não estiver disponível.
   * Quando o WS está activo (wsBalanceActive=true), este timer não inicia.
   */
  function startBalanceSync(intervalMs = 5000) {
    if (balanceSyncTimer || !isActive.value) return
    // Não inicia polling se o WebSocket já está a gerir as actualizações
    if (wsBalanceActive.value) return
    balanceSyncTimer = window.setInterval(() => {
      if (!isActive.value || wsBalanceActive.value) {
        stopBalanceSync()
        return
      }
      fetchCurrentSession({ silent: true })
    }, intervalMs)
  }

  function stopBalanceSync() {
    if (!balanceSyncTimer) return
    window.clearInterval(balanceSyncTimer)
    balanceSyncTimer = null
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
        // Actualização de saldo via WebSocket (ATUALIZACAO_SALDO) — sem setTimeout fixo.
        // Para REF (referência bancária), o saldo só actualiza após o webhook AppyPay.
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
        // Para GPO (Multicaixa Express): confirmação quase imediata.
        // Para REF (referência bancária): saldo actualiza via WebSocket após webhook AppyPay.
        // Não usamos setTimeout — o WebSocket notifica via ATUALIZACAO_SALDO quando chegar.
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

  return {
    isLoading, isActive, anonymousMode, balance, tableNumber,
    sessionId, fundoId, qrCodeSessao, identifiedTable, localName,
    identifyTable, getTableAccessToken, openSessionFromQR,
    openAnonymousSessionFromQR, fetchCurrentSession, rechargeFundClient,
    setSession, setBalance, setWsBalanceActive,
    startBalanceSync, stopBalanceSync
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSessionStore, import.meta.hot))
}
