<template>
  <div class="cart-view">
    <div class="top-nav">
      <button class="back-btn" @click="$router.back()">&#8592;</button>
      <h3>Carrinho</h3>
    </div>

    <div class="container">
      <div v-if="cart.items.length === 0" class="text-center mt-4">
        <p>O seu carrinho está vazio.</p>
        <button class="btn btn-outline mt-4" @click="$router.push('/menu')">Ir para o Cardápio</button>
      </div>

      <div v-else>
        <div class="card flex-row justify-between" v-for="item in cart.items" :key="item.id">
          <div>
            <h4>{{ item.nome }}</h4>
            <p class="text-primary mt-2">Kz {{ typeof item.preco === 'number' ? item.preco.toFixed(2) : '0.00' }}</p>
          </div>
          <div class="flex-row gap-3">
            <button class="qty-btn" @click="cart.removeItem(item.id)">-</button>
            <span>{{ item.quantity }}</span>
            <button class="qty-btn" @click="cart.addItem(item)">+</button>
          </div>
        </div>

        <div class="summary card mt-4">
          <div class="flex-row justify-between mb-2">
            <span>Subtotal</span>
            <span>Kz {{ typeof cart.totalPrice === 'number' ? cart.totalPrice.toFixed(2) : '0.00' }}</span>
          </div>
          <div class="flex-row justify-between mb-4">
            <strong>Total</strong>
            <strong class="text-primary">Kz {{ typeof cart.totalPrice === 'number' ? cart.totalPrice.toFixed(2) : '0.00' }}</strong>
          </div>
          
          <button class="btn btn-primary" @click="goToPayment">Confirmar Pedido</button>
          <button class="btn btn-outline mt-2" @click="$router.push('/menu')">Continuar Comprando</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useCartStore } from '../stores/CartStore'
import { useRouter } from 'vue-router'

const cart = useCartStore()
const router = useRouter()

function goToPayment() {
  if (cart.items.length > 0) {
    router.push('/payment')
  }
}
</script>

<style scoped>
.qty-btn {
  background-color: var(--surface-color-light);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.summary h3 {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}
</style>
