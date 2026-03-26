<template>
  <div class="payment-view">
    <div class="top-nav">
      <button class="back-btn" @click="$router.back()">&#8592;</button>
      <h3>Pagamento</h3>
    </div>

    <div class="container">
      <div v-if="errorMessage" class="alert alert-danger mb-4 p-3 rounded text-center">
        {{ errorMessage }}
      </div>

      <div v-if="!session.isActive" class="card mt-4 text-center">
        <h2 class="text-primary mb-2">Fundo Vazio</h2>
        <p class="mb-4">Deseja carregar fundo de consumo ou pagar apenas este pedido agora?</p>
        
        <button class="btn btn-primary mb-3" @click="payNow" :disabled="isProcessing">
          {{ isProcessing ? 'Processando...' : `Pagar Agora (Kz ${cart.totalPrice.toFixed(2)})` }}
        </button>
        <button class="btn btn-outline" @click="$router.push('/wallet')" :disabled="isProcessing">Carregar Fundo de Consumo</button>
      </div>

      <div v-else class="card mt-4">
        <h3>Saldo Atual</h3>
        <h2 class="text-success mb-4">Kz {{ session.balance.toFixed(2) }}</h2>
        
        <div class="flex-row justify-between mb-4">
          <span>Total do Pedido:</span>
          <span>Kz {{ cart.totalPrice.toFixed(2) }}</span>
        </div>

        <button 
          class="btn btn-primary" 
          :disabled="session.balance < cart.totalPrice || isProcessing"
          @click="payWithBalance">
          {{ isProcessing ? 'Processando...' : 'Pagar com Saldo' }}
        </button>

        <button 
          class="btn btn-outline mt-3" 
          style="width: 100%; border-color: var(--primary-color); color: var(--primary-color);"
          :disabled="isProcessing"
          @click="payAtCounter">
          {{ isProcessing ? 'Processando...' : 'Pagar no Balcão' }}
        </button>

        <p v-if="session.balance < cart.totalPrice" class="text-secondary mt-2 text-center" style="font-size: 13px;">
          Saldo insuficiente para débito direto. Pode optar por pagar no balcão ou <a href="#" @click.prevent="$router.push('/wallet')">recarregar saldo</a>.
        </p>

        <hr class="mt-4 mb-4" style="border-color: var(--border-color); opacity: 0.5;">
        
        <h4 class="mb-2 text-center">Ou pagar com QR Code de terceiro</h4>
        <div class="flex-row gap-2 mt-3" style="display: flex; gap: 8px;">
          <input type="text" v-model="qrCodeFundo" placeholder="Cole o código do fundo..." class="form-control" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);" :disabled="isProcessing"/>
          <button class="btn btn-outline" @click="payWithQRCode" :disabled="!qrCodeFundo || isProcessing">Pagar c/ Fundo Externo</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCartStore } from '../stores/CartStore'
import { useSessionStore } from '../stores/SessionStore'
import { useOrdersStore } from '../stores/OrdersStore'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/auth'

const cart = useCartStore()
const session = useSessionStore()
const orders = useOrdersStore()
const router = useRouter()

const errorMessage = ref('')
const isProcessing = ref(false)
const qrCodeFundo = ref('')

// Carregar sessão ao entrar na página, se ainda não estiver carregada
onMounted(async () => {
  if (!session.isActive && AuthService.isAuthenticated()) {
    await session.fetchCurrentSession()
  }
})

async function payNow() {
  // Redireciona para login se não estiver autenticado
  if (!AuthService.isAuthenticated()) {
    router.push({ path: '/login', query: { redirect: '/payment' } })
    return
  }
  await processOrder(null, 'PRE_PAGO')
}

async function payWithBalance() {
  await processOrder(null, 'PRE_PAGO')
}

async function payAtCounter() {
  await processOrder(null, 'POS_PAGO')
}

async function payWithQRCode() {
  await processOrder(qrCodeFundo.value)
}

async function processOrder(qrCode = null, tipoPagamento = 'PRE_PAGO') {
  errorMessage.value = ''
  isProcessing.value = true

  try {
    await orders.addOrder(cart.items, cart.totalPrice, qrCode, tipoPagamento)
    cart.clearCart()
    router.push('/dashboard')
  } catch (error) {
    console.error('Stacktrace do Checkout:', error)
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage.value = error.response.data.message
    } else {
      errorMessage.value = 'Falha ao conectar com o servidor.'
    }
  } finally {
    isProcessing.value = false
  }
}
</script>

<style scoped>
.text-danger {
  color: var(--danger-color);
  font-size: 14px;
}
</style>
