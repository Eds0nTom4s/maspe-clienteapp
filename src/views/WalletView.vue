<template>
  <div class="wallet-view pb-20">
    <div class="top-nav">
      <button class="back-btn" v-if="!session.isActive" @click="$router.back()">&#8592;</button>
      <h3 :class="{ 'ml-auto': session.isActive }">Carteira</h3>
    </div>

    <div class="container">
      <div v-if="errorMessage" class="alert alert-danger mb-4 p-3 rounded text-center">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert-success mb-4 p-3 rounded text-center" style="background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;">
        {{ successMessage }}
      </div>

      <div class="card text-center mb-4">
        <p>Fundo de Consumo</p>
        <h1 class="text-success mt-2 mb-4">Kz {{ session.balance.toFixed(2) }}</h1>
      </div>

      <h3>Carregar Fundo</h3>
      <div class="amounts grid-2 mt-3 mb-4">
        <button class="btn btn-outline" @click="loadAmount(5000)" :disabled="isProcessing">
          {{ isProcessing ? '...' : 'Kz 5,000' }}
        </button>
        <button class="btn btn-outline" @click="loadAmount(10000)" :disabled="isProcessing">
          {{ isProcessing ? '...' : 'Kz 10,000' }}
        </button>
        <button class="btn btn-outline" @click="loadAmount(20000)" :disabled="isProcessing">
          {{ isProcessing ? '...' : 'Kz 20,000' }}
        </button>
        <button class="btn btn-outline" @click="loadAmount(50000)" :disabled="isProcessing">
          {{ isProcessing ? '...' : 'Kz 50,000' }}
        </button>
      </div>

      <div class="card bg-surface-light text-sm mb-4">
        <p>Garantimos a devolução de qualquer fundo não utilizado no final da sua sessão.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSessionStore } from '../stores/SessionStore'
import { useRouter } from 'vue-router'

const session = useSessionStore()
const router = useRouter()

const isProcessing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function loadAmount(amount) {
  isProcessing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await session.rechargeFundClient(amount)
    
    successMessage.value = response.message || 'Fundo carregado com sucesso!'
    
    // Pequeno atraso para o utlizador ler a mensagem de sucesso
    setTimeout(() => {
      if (router.currentRoute.value.query.redirect === 'cart') {
        router.push('/cart')
      } else {
        router.push('/dashboard')
      }
    }, 1500)
    
  } catch (error) {
    if (error.response && error.response.status === 401) {
       errorMessage.value = 'A sua sessão expirou. Direcionando para login...'
       // Interceptor should handle this, but acting as fallback:
       setTimeout(() => router.push('/login'), 2000)
    } else if (error.response && error.response.data && error.response.data.message) {
      errorMessage.value = error.response.data.message
    } else {
      errorMessage.value = 'Houve um erro de servidor ao processar o seu pagamento (AppyPay).'
    }
  } finally {
    isProcessing.value = false
  }
}
</script>

<style scoped>
.pb-20 {
  padding-bottom: 80px;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.bg-surface-light {
  background-color: var(--surface-color-light);
}
.text-sm {
  font-size: 14px;
}
</style>
