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
      <div v-if="!session.isActive" class="alert alert-warning mb-4 p-3 rounded text-center">
        Leia o QR Code da mesa antes de carregar o fundo.
      </div>

      <div class="card text-center mb-4">
        <p>Fundo de Consumo</p>
        <SensitiveBalance
          class="mt-2 mb-4"
          :amount="normalizedBalance"
          heading-tag="h1"
          value-class="text-success"
        />
      </div>

      <h3>Carregar Fundo</h3>
      <div class="card mb-4">
        <h4 class="mb-3">Método</h4>
        <div class="grid-2">
          <button class="btn" :class="metodoPagamento === 'GPO' ? 'btn-primary' : 'btn-outline'" @click="metodoPagamento = 'GPO'">Multicaixa Express</button>
          <button class="btn" :class="metodoPagamento === 'REF' ? 'btn-primary' : 'btn-outline'" @click="metodoPagamento = 'REF'">Referência</button>
        </div>
        <button class="btn btn-outline mt-3" style="width: 100%;" @click="metodoPagamento = 'BALCAO'">Pagar no Balcão</button>
      </div>
      <div v-if="metodoPagamento === 'BALCAO'" class="alert alert-warning mb-4 p-3 rounded text-center">
        Apresente o QR Code abaixo ao atendente para carregar no balcão.
      </div>
      <div class="amounts grid-2 mt-3 mb-4">
        <button class="btn btn-outline" @click="loadAmount(5000)" :disabled="isProcessing || !session.isActive || metodoPagamento === 'BALCAO'">
          {{ isProcessing ? '...' : 'Kz 5,000' }}
        </button>
        <button class="btn btn-outline" @click="loadAmount(10000)" :disabled="isProcessing || !session.isActive || metodoPagamento === 'BALCAO'">
          {{ isProcessing ? '...' : 'Kz 10,000' }}
        </button>
        <button class="btn btn-outline" @click="loadAmount(20000)" :disabled="isProcessing || !session.isActive || metodoPagamento === 'BALCAO'">
          {{ isProcessing ? '...' : 'Kz 20,000' }}
        </button>
        <button class="btn btn-outline" @click="loadAmount(50000)" :disabled="isProcessing || !session.isActive || metodoPagamento === 'BALCAO'">
          {{ isProcessing ? '...' : 'Kz 50,000' }}
        </button>
      </div>

      <div class="qr-counter-section text-center p-4 border-dashed rounded-xl mt-6">
        <h4 class="mb-2">Carregamento no Balcão</h4>
        <p class="text-xs text-secondary mb-4">Apresente o QR Code abaixo ao atendente para carregar com dinheiro ou TPA.</p>
        
        <div class="qr-box bg-white p-3 rounded-lg inline-block shadow-sm">
          <qrcode-vue
            v-if="session.qrCodeSessao"
            :value="session.qrCodeSessao"
            :size="140"
            level="M"
            render-as="svg"
          />
          <div v-else class="text-secondary p-4">Código indisponível</div>
        </div>
        
        <div class="mt-3">
          <span class="text-xs text-secondary uppercase">Ref de Sessão:</span>
          <p class="font-bold text-primary">{{ session.qrCodeSessao || '---' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useSessionStore } from '../stores/SessionStore'
import { useRouter } from 'vue-router'
import QrcodeVue from 'qrcode.vue'
import SensitiveBalance from '../components/SensitiveBalance.vue'

const session = useSessionStore()
const router = useRouter()

const isProcessing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const metodoPagamento = ref('GPO')
const normalizedBalance = computed(() => Number(session.balance || 0))

onMounted(() => {
  if (session.isActive) {
    session.fetchCurrentSession({ silent: true })
    session.startBalanceSync()
  }
})

async function loadAmount(amount) {
  if (!session.isActive) {
    errorMessage.value = 'Leia o QR Code da mesa antes de carregar o fundo.'
    return
  }

  isProcessing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await session.rechargeFundClient(amount, metodoPagamento.value)
    
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
.border-dashed {
  border: 2px dashed var(--border-color);
}
.qr-counter-section {
  background-color: var(--surface-color);
}
.qr-box {
  border: 1px solid var(--border-color);
}
</style>
