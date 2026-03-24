import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'
import { wsService } from '../services/websocket'
import { useSessionStore } from './SessionStore'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref([])
  const isLoading = ref(false)

  // GET /pedidos/cliente
  async function fetchClientOrders() {
    isLoading.value = true
    try {
      const { data } = await api.get('/pedidos/cliente')
      if (data && data.success && data.data) {
        // Formatar para o frontend store state
        orders.value = data.data.map(pedido => {
          return {
            id: pedido.id,
            numero: pedido.numero,
            items: pedido.itens.map(i => ({ 
              id: i.produtoId, 
              nome: i.nomeProduto, 
              quantity: i.quantidade 
            })),
            total: pedido.total,
            status: pedido.status,
            totalSubPedidos: pedido.totalSubPedidos || 0,
            completedSubPedidos: pedido.completedSubPedidos || 0,
            subpedidosMap: {},
            timestamp: pedido.createdAt || new Date()
          }
        })

        // Susbcribe to real-time updates for active requests on load
        const activeOrders = orders.value.filter(o => o.status !== 'Entregue' && o.status !== 'Finalizado' && o.status !== 'Cancelado')
        if (activeOrders.length > 0) {
          wsService.connect(
            () => {
              activeOrders.forEach(order => {
                wsService.subscribeToOrderUpdates(order.id, (message) => {
                  console.log('Order update received from history:', message)
                  handleOrderUpdate(order.id, message)
                })
              })
            },
            (error) => console.error('WebSocket connection failed (History load)', error)
          )
        }
      }
    } catch (error) {
      console.error('Falha ao buscar os pedidos do cliente:', error)
    } finally {
      isLoading.value = false
    }
  }

  // POST /pedidos/cliente
  async function addOrder(cartItems, total, qrCodeFundo = null) {
    isLoading.value = true
    const sessionStore = useSessionStore()
    
    try {
      const payload = {
        sessaoConsumoId: sessionStore.sessionId,
        tipoPagamento: 'PRE_PAGO',
        itens: cartItems.map(item => ({
          produtoId: item.id,
          quantidade: item.quantity,
          observacoes: ''
        }))
      }
      
      if (qrCodeFundo) {
        payload.qrCodeFundo = qrCodeFundo
      }
      
      const { data } = await api.post('/pedidos/cliente', payload)
      
      const pedido = data.data
      
      const newOrder = {
        id: pedido.id || Math.random().toString(36).substr(2, 9),
        numero: pedido.numero,
        items: [...cartItems],
        total,
        status: pedido.status || 'CRIADO',
        totalSubPedidos: pedido.totalSubPedidos || 0,
        completedSubPedidos: pedido.completedSubPedidos || 0,
        subpedidosMap: {},
        timestamp: new Date()
      }
      
      orders.value.push(newOrder)
      
      // Suscribe to real-time updates for this order
      wsService.connect(
        () => {
          wsService.subscribeToOrderUpdates(newOrder.id, (message) => {
            console.log('Order update received:', message)
            handleOrderUpdate(message.pedidoId || message.id, message)
          })
        },
        (error) => console.error('WebSocket connection failed', error)
      )

      return newOrder
    } catch (error) {
      console.error('Failed to place order via API:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function updateOrderStatus(orderId, newStatus) {
    const idx = orders.value.findIndex(o => o.id === orderId)
    if (idx !== -1) {
      orders.value[idx].status = newStatus
    }
  }

  function handleOrderUpdate(orderId, message) {
    const idx = orders.value.findIndex(o => o.id === orderId)
    if (idx !== -1) {
      const order = orders.value[idx]
      
      if (message.tipo === 'PEDIDO_AGUARDANDO_CONFIRMACAO') {
        order.status = 'AGUARDANDO_PAGAMENTO'
        return
      }

      // se for NotificacaoSubPedidoDTO
      if (message.numero) {
        const subId = message.id
        const newStatus = message.statusNovo
        
        if (!order.subpedidosMap[subId]) {
          order.subpedidosMap[subId] = message.statusAnterior || 'CRIADO'
        }
        
        const oldStatus = order.subpedidosMap[subId]
        order.subpedidosMap[subId] = newStatus
        
        const isNowCompleted = newStatus === 'PRONTO' || newStatus === 'ENTREGUE'
        const wasCompleted = oldStatus === 'PRONTO' || oldStatus === 'ENTREGUE'
        
        if (isNowCompleted && !wasCompleted) {
          order.completedSubPedidos++
        } else if (!isNowCompleted && wasCompleted) {
          order.completedSubPedidos--
        }
        
        if (order.totalSubPedidos > 0) {
          if (order.completedSubPedidos > 0 && order.completedSubPedidos < order.totalSubPedidos) {
            order.status = 'Em preparação'
          } else if (order.completedSubPedidos === order.totalSubPedidos) {
            order.status = 'Pronto'
          }
        }
      } else if (message.statusNovo) {
        // Fallback for direct order status updates
        order.status = message.statusNovo
      }
    }
  }

  return { orders, isLoading, addOrder, updateOrderStatus, handleOrderUpdate, fetchClientOrders }
})
