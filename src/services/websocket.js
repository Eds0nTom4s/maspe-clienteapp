import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'

// Em desenvolvimento, /api/ws passa pelo proxy Vite para o backend Docker.
const WS_URL = import.meta.env.VITE_WS_URL || '/api/ws'

class WebSocketService {
  constructor() {
    this.client = null
    this.subscriptions = new Map()
  }

  connect(onConnectCb, onErrorCb) {
    if (this.client && this.client.active) return

    const token = localStorage.getItem('token')

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      debug: (str) => {
        if (import.meta.env.DEV) console.log('STOMP: ', str)
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    })

    this.client.onConnect = (frame) => {
      console.log('Connected to WebSocket server')
      if (onConnectCb) onConnectCb(frame)
    }

    this.client.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message'])
      console.error('Additional details: ' + frame.body)
      if (onErrorCb) onErrorCb(frame)
    }

    this.client.activate()
  }

  // Subscribe to Orders updates. Topic: /topic/pedido/{pedidoId}
  subscribeToOrderUpdates(pedidoId, callback) {
    if (!this.client || !this.client.connected) {
      console.warn('Cannot subscribe, STOMP client not connected')
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
      console.warn('Cannot subscribe to session, STOMP client not connected')
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
