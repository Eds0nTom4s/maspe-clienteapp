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
        <div class="card" v-for="order in ordersStore.orders" :key="order.id">
          <div class="flex-row justify-between mb-2">
            <span>{{ new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }} - #{{ order.id }}</span>
            <span class="text-primary font-bold">Kz {{ typeof order.total === 'number' ? order.total.toFixed(2) : '0.00' }}</span>
          </div>
          <div class="order-items">
            <div v-for="item in order.items" :key="item.id" class="text-sm py-1">
              {{ item.quantity }}x {{ item.nome }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOrdersStore } from '../stores/OrdersStore'

const ordersStore = useOrdersStore()

onMounted(() => {
  ordersStore.fetchClientOrders()
})
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
</style>
