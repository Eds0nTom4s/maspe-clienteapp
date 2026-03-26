<template>
  <div class="history-view pb-20">
    <div class="top-nav">
      <h3>Histórico</h3>
    </div>

    <div class="container">
      <div v-if="ordersStore.orders.length === 0" class="text-center text-secondary py-4">
        Ainda não efetuou pedidos.
      </div>

      <div class="order-list">
        <div class="card clickable" v-for="order in ordersStore.orders" :key="order.id" @click="toggleOrder(order.id)">
          <div class="flex-row justify-between mb-2">
            <span>{{ new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }} - #{{ order.id }}</span>
            <span class="text-primary font-bold">Kz {{ typeof order.total === 'number' ? order.total.toFixed(2) : '0.00' }}</span>
          </div>
          <div class="order-items mb-3">
            <div v-for="item in order.items" :key="item.id" class="text-sm py-1">
              {{ item.quantity }}x {{ item.nome }}
            </div>
          </div>
          
          <transition name="fade-slide">
            <div v-if="expandedOrders.has(order.id) && order.subpedidos && order.subpedidos.length > 0" class="sub-orders mt-3 pt-3 border-t">
              <div v-for="sub in order.subpedidos" :key="sub.id" class="sub-order-row flex justify-between items-center py-1">
                <span class="text-xs text-secondary">{{ sub.nomeCozinha }}</span>
                <span class="text-xs font-bold" :style="{ color: getStatusColor(sub.status) }">
                  {{ formatStatus(sub.status) }}
                </span>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOrdersStore } from '../stores/OrdersStore'

const ordersStore = useOrdersStore()
const expandedOrders = ref(new Set())

function toggleOrder(orderId) {
  if (expandedOrders.value.has(orderId)) {
    expandedOrders.value.delete(orderId)
  } else {
    expandedOrders.value.add(orderId)
  }
}

onMounted(() => {
  ordersStore.fetchClientOrders()
})

function getStatusColor(status) {
  if (status === 'PRONTO' || status === 'Pronto') return 'var(--success-color)'
  if (status === 'EM_PREPARACAO' || status === 'Em preparação') return 'var(--warning-color)'
  if (status === 'CANCELADO') return 'var(--danger-color)'
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
  padding-bottom: 80px;
}
.font-bold {
  font-weight: bold;
}
.text-sm {
  font-size: 14px;
  color: var(--text-secondary);
}
.border-t {
  border-top: 1px solid var(--border-color);
}
.mb-3 {
  margin-bottom: 12px;
}
.flex {
  display: flex;
}
.justify-between {
  justify-content: space-between;
}
.items-center {
  align-items: center;
}
.text-xs {
  font-size: 12px;
}

.clickable {
  cursor: pointer;
  transition: transform 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.clickable:active {
  transform: scale(0.98);
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
  transform: translateY(-5px);
}
</style>
