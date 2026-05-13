import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import { AuthService } from './auth'

// Em desenvolvimento, /api/ws passa pelo proxy Vite para o backend Docker.
const WS_URL = import.meta.env.VITE_WS_URL || '/api/ws'

class WebSocketService {
  constructor() {
    this.client = null
    this.subscriptions = new Map()
    this._onAuthErrorCb = null // callback para notificar a app de falha de autenticação
  }

  /**
   * Regista um callback a invocar quando o WebSocket for rejeitado por autenticação.
   * Tipicamente usado para forçar logout/redirect na app.
   */
  onAuthError(cb) {
    this._onAuthErrorCb = cb
  }

  connect(onConnectCb, onErrorCb) {
    if (this.client && this.client.active) return

    const token = AuthService.getToken()

    // Não tenta conectar se o token já expirou — evita o loop de 5s nos logs
    if (!token || AuthService.isTokenExpired(token)) {
      console.warn('[WS] Token ausente ou expirado. Ligação WebSocket cancelada.')
      if (this._onAuthErrorCb) this._onAuthErrorCb()
      return
    }

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      debug: (str) => {
        if (import.meta.env.DEV) console.log('STOMP: ', str)
      },
      // Só reconecta automaticamente se a falha NÃO for de autenticação
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    })

    this.client.onConnect = (frame) => {
      console.log('[WS] Conectado ao servidor WebSocket')
      if (onConnectCb) onConnectCb(frame)
    }

    this.client.onStompError = (frame) => {
      const msg = frame.headers['message'] || ''
      console.error('[WS] Erro STOMP:', msg)

      // Se for erro de autenticação (token expirado/inválido), para o loop imediatamente
      const isAuthError = msg.includes('401') ||
                          msg.includes('inválido') ||
                          msg.includes('Token JWT') ||
                          msg.includes('Unauthorized')
      if (isAuthError) {
        console.warn('[WS] Erro de autenticação detectado. A parar reconexões.')
        this.client.deactivate()
        if (this._onAuthErrorCb) this._onAuthErrorCb()
        return
      }

      if (onErrorCb) onErrorCb(frame)
    }

    this.client.activate()
  }

  // Subscribe to Orders updates. Topic: /topic/pedido/{pedidoId}
  subscribeToOrderUpdates(pedidoId, callback) {
    if (!this.client || !this.client.connected) {
      console.warn('[WS] Não é possível subscrever — STOMP não está conectado')
      return null
    }

    const topic = `/topic/pedido/${pedidoId}`
    const sub = this.client.subscribe(topic, (message) => {
      if (message.body) {
        const payload = JSON.parse(message.body)
        callback(payload)
      }
    })

    this.subscriptions.set(topic, sub)
    return sub
  }

  // Subscribe to Session/Balance updates. Topic: /topic/sessao/{qrCodeSessao}
  subscribeToSessionUpdates(qrCodeSessao, callback) {
    if (!this.client || !this.client.connected) {
      console.warn('[WS] Não é possível subscrever à sessão — STOMP não está conectado')
      return null
    }

    const topic = `/topic/sessao/${qrCodeSessao}`
    const sub = this.client.subscribe(topic, (message) => {
      if (message.body) {
        const payload = JSON.parse(message.body)
        callback(payload)
      }
    })

    this.subscriptions.set(topic, sub)
    return sub
  }

  unsubscribe(topic) {
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic).unsubscribe()
      this.subscriptions.delete(topic)
    }
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate()
      this.subscriptions.clear()
    }
  }
}

export const wsService = new WebSocketService()
