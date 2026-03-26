<template>
  <div class="dashboard-view pb-20">
    <div class="top-nav">
      <h3>Minha Sessão</h3>
    </div>

    <div class="container">
      <div class="card bg-gradient mb-4 p-4 text-center">
        <p>Saldo Atual</p>
        <h1 class="text-success mb-2">Kz {{ typeof session.balance === 'number' ? session.balance.toFixed(2) : '0.00' }}</h1>
        <div class="flex-row gap-2 mt-3">
          <button class="btn btn-primary flex-1 btn-sm" @click="$router.push('/wallet')">Carregar Fundo</button>
          <button class="btn btn-outline flex-1 btn-sm text-white" style="border-color: rgba(255,255,255,0.3)" @click="showQrModal = true">Meu QR / Pagar</button>
        </div>
      </div>

      <div class="d-flex justify-between align-center mb-4">
        <h3>Pedidos Ativos</h3>
      </div>

      <div v-if="activeOrders.length === 0" class="text-center text-secondary py-4">
        Nenhum pedido em andamento.
      </div>

      <div class="order-list">
        <div class="card clickable" v-for="order in activeOrders" :key="order.id" @click="toggleOrder(order.id)">
          <div class="flex-row justify-between mb-2 pb-2 border-b">
            <span>Pedido #{{ order.numero || order.id }}</span>
            <div class="flex-row items-center gap-2">
               <span class="status-badge" :class="getStatusClass(order.status)">{{ order.status }}</span>
               <i class="chevron" :class="{ 'chevron-up': expandedOrders.has(order.id) }"></i>
            </div>
          </div>

          <!-- Loading dinâmico (Taxa de Conclusão) -->
          <div v-if="order.totalSubPedidos > 0" class="mb-3">
            <div class="flex justify-between text-xs text-secondary mb-1">
              <span>Progresso</span>
              <span>{{ order.completedSubPedidos || 0 }} / {{ order.totalSubPedidos }}</span>
            </div>
            <div class="w-full bg-surface-color-light rounded-full h-2">
              <div class="bg-primary h-2 rounded-full transition-all duration-500 ease-in-out" 
                   :style="{ width: (((order.completedSubPedidos || 0) / order.totalSubPedidos) * 100) + '%' }">
              </div>
            </div>
          </div>
          
          <div class="order-items mb-3">
            <div v-for="item in order.items" :key="item.id" class="text-sm py-1">
              {{ item.quantity }}x {{ item.nome }}
            </div>
          </div>

          <!-- Detalhe por Cozinha (SubPedidos) - EXPANSÍVEL -->
          <transition name="fade-slide">
            <div v-if="expandedOrders.has(order.id) && order.subpedidos && order.subpedidos.length > 0" class="sub-orders mt-3 pt-3 border-t">
              <p class="text-xs font-bold uppercase text-secondary mb-2 tracking-wider">Estado da Preparação:</p>
              <div v-for="sub in order.subpedidos" :key="sub.id" class="sub-order-row flex justify-between items-center py-1">
                <span class="text-xs text-text-primary">{{ sub.nomeCozinha }}</span>
                <span class="status-dot-label flex items-center gap-1">
                  <span class="status-dot" :class="getStatusDotClass(sub.status)"></span>
                  <span class="text-xs" :style="{ color: getStatusColor(sub.status) }">{{ formatStatus(sub.status) }}</span>
                </span>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
    <!-- Modal QR Code -->
    <div v-if="showQrModal" class="modal-overlay" @click.self="showQrModal = false">
      <div class="modal-content text-center scale-up">
        <div class="modal-header justify-between">
          <h3 class="m-0 text-text-primary">Minha Conta (QR)</h3>
          <button class="btn-close" @click="showQrModal = false">&times;</button>
        </div>
        <div class="modal-body py-4 flex-col items-center">
          <p class="text-sm text-secondary mb-4">
            Apresente este código para que outra pessoa possa pagar a sua conta, ou partilhe a ref de sessão.
          </p>
          <div class="qr-container bg-white p-4 rounded-xl inline-block shadow-sm mb-4">
            <qrcode-vue
              v-if="session.qrCodeSessao"
              :value="session.qrCodeSessao"
              :size="180"
              level="M"
              render-as="svg"
            />
            <div v-else class="text-secondary p-8">Código indisponível</div>
          </div>
          <div class="bg-surface-color-light p-3 rounded-lg w-full">
            <p class="text-xs text-secondary mb-1 uppercase tracking-wider">Código de Sessão:</p>
            <p class="text-lg font-bold text-primary tracking-widest">{{ session.qrCodeSessao || 'N/D' }}</p>
          </div>
        </div>
        <div class="modal-footer p-0 mt-3">
          <button class="btn btn-primary w-full" @click="showQrModal = false">Fechar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '../stores/SessionStore'
import { useOrdersStore } from '../stores/OrdersStore'
import { wsService } from '../services/websocket'
import QrcodeVue from 'qrcode.vue'

const session = useSessionStore()
const ordersStore = useOrdersStore()

const showQrModal = ref(false)
const expandedOrders = ref(new Set()) // Armazena IDs dos pedidos expandidos

const activeOrders = computed(() => {
  return ordersStore.orders.filter(o => o.status !== 'Entregue' && o.status !== 'Finalizado' && o.status !== 'Cancelado')
})

function toggleOrder(orderId) {
  if (expandedOrders.value.has(orderId)) {
    expandedOrders.value.delete(orderId)
  } else {
    expandedOrders.value.add(orderId)
  }
}

onMounted(() => {
  ordersStore.fetchClientOrders()
  session.fetchCurrentSession().then(() => {
    // Inscrever para atualizações de saldo silenciosas
    if (session.qrCodeSessao) {
      wsService.connect(() => {
        wsService.subscribeToSessionUpdates(session.qrCodeSessao, (event) => {
          if (event.tipo === 'ATUALIZACAO_SALDO') {
            console.log('💰 Saldo atualizado via WebSocket:', event.novoSaldo)
            session.balance = event.novoSaldo
          }
        })
      })
    }
  })
})

onUnmounted(() => {
  if (session.qrCodeSessao) {
    wsService.unsubscribe(`/topic/sessao/${session.qrCodeSessao}`)
  }
})

function getStatusClass(status) {
  if (status === 'PRONTO' || status === 'Pronto') return 'badge-success'
  if (status === 'EM_PREPARACAO' || status === 'Em preparação') return 'badge-warning'
  if (status === 'CANCELADO') return 'badge-danger'
  return 'badge-neutral'
}

function getStatusDotClass(status) {
  if (status === 'PRONTO') return 'dot-success'
  if (status === 'EM_PREPARACAO') return 'dot-warning'
  if (status === 'CANCELADO') return 'dot-danger'
  if (status === 'PENDENTE') return 'dot-primary'
  return 'dot-neutral'
}

function getStatusColor(status) {
  if (status === 'PRONTO') return 'var(--success-color)'
  if (status === 'EM_PREPARACAO') return 'var(--warning-color)'
  if (status === 'CANCELADO') return 'var(--danger-color)'
  if (status === 'PENDENTE') return 'var(--primary-color)'
  return 'var(--text-secondary)'
}

function formatStatus(status) {
  const map = {
    'CRIADO': 'Recebido',
    'PENDENTE': 'Fila de Espera',
    'EM_PREPARACAO': 'A preparar',
    'PRONTO': 'Pronto',
    'ENTREGUE': 'Entregue',
    'CANCELADO': 'Cancelado'
  }
  return map[status] || status
}
</script>

<style scoped>
.pb-20 {
  padding-bottom: 80px; /* Space for bottom nav */
}
.bg-gradient {
  background: linear-gradient(135deg, var(--surface-color) 0%, #172a40 100%);
  border: 1px solid var(--primary-color);
}
.btn-sm {
  padding: 8px 16px;
  width: auto;
  font-size: 14px;
}
.border-b {
  border-bottom: 1px solid var(--border-color);
}
.text-sm {
  font-size: 14px;
  color: var(--text-secondary);
}
.status-badge {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 600;
}
.badge-warning {
  background-color: rgba(255, 204, 0, 0.2);
  color: var(--warning-color);
}
.badge-success {
  background-color: rgba(76, 217, 100, 0.2);
  color: var(--success-color);
}
.badge-neutral {
  background-color: var(--surface-color-light);
  color: var(--text-primary);
}
.flex-row {
  display: flex;
  flex-direction: row;
}
.gap-2 {
  gap: 8px;
}
.flex-1 {
  flex: 1;
}
.text-white {
  color: #fff;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}
.tracking-widest {
  letter-spacing: 0.1em;
}
.tracking-wider {
  letter-spacing: 0.05em;
}
/* Modal classes if not globally defined */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-content {
  background: var(--surface-color);
  padding: 24px;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.modal-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.m-0 {
  margin: 0;
}
.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
}
.scale-up {
  animation: scaleUp 0.3s ease-out;
}
@keyframes scaleUp {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.border-t {
  border-top: 1px solid var(--border-color);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot-success { background-color: var(--success-color); box-shadow: 0 0 6px var(--success-color); }
.dot-warning { background-color: var(--warning-color); animation: pulse 2s infinite; }
.dot-primary { background-color: var(--primary-color); }
.dot-danger { background-color: var(--danger-color); }
.dot-neutral { background-color: var(--text-secondary); }

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}

.badge-danger {
  background-color: rgba(255, 59, 48, 0.2);
  color: var(--danger-color);
}

.clickable {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.clickable:active {
  transform: scale(0.98);
}

.chevron {
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--text-secondary);
  border-bottom: 2px solid var(--text-secondary);
  transform: rotate(45deg);
  transition: transform 0.3s ease;
  display: block;
}
.chevron-up {
  transform: rotate(-135deg);
}

/* Transições Vue */
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.3s ease;
  max-height: 200px;
  overflow: hidden;
}
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}
</style>
