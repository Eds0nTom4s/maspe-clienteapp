<template>
  <div class="container text-center" style="justify-content: center;">
    <div style="margin-bottom: 40px;">
      <h1>Bem-vindo ao</h1>
      <h2 class="text-primary">{{ session.localName }}</h2>
      <p>{{ mesaIdentificadaLabel }}</p>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mb-4 p-3 rounded text-center">
      {{ errorMessage }}
    </div>

    <div class="card text-center mb-4">
      <h3 class="text-primary mb-2">Identificar mesa</h3>
      <p class="text-secondary mb-3">Digite a referência ou o código QR impresso na mesa.</p>
      <input
        v-model="manualCode"
        type="text"
        inputmode="text"
        autocomplete="off"
        autocapitalize="characters"
        maxlength="20"
        placeholder="Ex: MASPE-MESA-0001"
        class="form-control mb-3"
        style="text-align: center; text-transform: uppercase;"
        :disabled="session.isLoading"
        @keyup.enter="joinByManualCode"
      />

      <button class="btn btn-primary" :disabled="session.isLoading || !manualCode.trim()" @click="identifyByManualCode">
        {{ session.isLoading ? 'A identificar...' : 'Identificar mesa' }}
      </button>

      <div v-if="identifiedTable" class="table-confirmation mt-3">
        <div>
          <strong>{{ identifiedTable.referencia }}</strong>
          <span>{{ identifiedTable.unidadeAtendimentoNome || session.localName }}</span>
        </div>
        <small>{{ identifiedTable.ativa === false ? 'Mesa indisponível' : 'Mesa identificada' }}</small>
      </div>

      <div v-if="identifiedTable" class="entry-actions mt-3">
        <button class="btn btn-primary" :disabled="session.isLoading || identifiedTable.ativa === false || !mesaAccessToken" @click="joinByManualCode">
          {{ session.isLoading ? 'A entrar...' : 'Entrar com telefone' }}
        </button>
        <button class="btn btn-outline mt-2" :disabled="session.isLoading || identifiedTable.ativa === false || !mesaAccessToken" @click="joinAnonymouslyByManualCode">
          Consumir anonimamente
        </button>
        <p v-if="!mesaAccessToken" class="text-secondary mt-2">
          Esta mesa ainda não tem QR/token de acesso configurado. Peça apoio ao balcão.
        </p>
      </div>
    </div>

    <div class="actions" style="display: flex; flex-direction: column; gap: 16px;">
      <button class="btn btn-primary" @click="$router.push('/menu')">
        Ver Cardápio
      </button>
      <button class="btn btn-secondary" @click="$router.push('/dashboard')">
        Gerir Consumo
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useSessionStore } from '../stores/SessionStore'
import { useRoute, useRouter } from 'vue-router'
import { AuthService } from '../services/auth'
import api from '../services/api'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const errorMessage = ref('')
const manualCode = ref('')
const identifiedTable = ref(null)

const mesaAccessToken = computed(() => identifiedTable.value?.qrCode || normalizeToken(manualCode.value, false))
const mesaIdentificadaLabel = computed(() => {
  if (session.tableNumber) return `Mesa ${session.tableNumber}`
  if (identifiedTable.value?.referencia) return `Mesa ${identifiedTable.value.referencia}`
  return 'Mesa não identificada'
})

function normalizeToken(token, setError = true) {
  const normalizedToken = String(token || '').trim().toUpperCase()
  if (!normalizedToken) {
    if (setError) errorMessage.value = 'Informe o código da mesa.'
    return null
  }
  return normalizedToken
}

watch(manualCode, () => {
  identifiedTable.value = null
  errorMessage.value = ''
})

async function identifyTableCode(code) {
  const normalizedCode = normalizeToken(code)
  if (!normalizedCode) return null

  try {
    errorMessage.value = ''
    const mesa = typeof session.identifyTable === 'function'
      ? await session.identifyTable(normalizedCode)
      : await identifyTableDirectly(normalizedCode)
    identifiedTable.value = mesa
    if (!mesa?.qrCode) {
      errorMessage.value = 'Mesa encontrada, mas sem QR/token de acesso configurado.'
    }
    return mesa
  } catch (error) {
    identifiedTable.value = null
    errorMessage.value = error.response?.data?.message || 'Mesa não encontrada. Confira o código impresso.'
    console.error('Erro ao identificar mesa:', error)
    return null
  }
}

async function identifyTableDirectly(normalizedCode) {
  session.isLoading = true
  try {
    const { data } = await api.get(`/public/mesa/${encodeURIComponent(normalizedCode)}`)
    const mesa = data.data
    session.identifiedTable = mesa
    session.tableNumber = mesa?.referencia || ''
    return mesa
  } finally {
    session.isLoading = false
  }
}

async function joinByToken(token) {
  const normalizedToken = normalizeToken(token || mesaAccessToken.value)
  if (!normalizedToken) return

  if (!AuthService.isAuthenticated()) {
    router.push({ path: '/login', query: { redirect: `/?qr=${encodeURIComponent(normalizedToken)}` } })
    return
  }

  try {
    errorMessage.value = ''
    await session.openSessionFromQR(normalizedToken)
    console.log('Sessão vinculada com sucesso via QR Code!')
    router.push('/dashboard')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Falha ao processar o código da mesa.'
    console.error('Erro na leitura do QR:', error)
  }
}

async function joinAnonymouslyByToken(token) {
  const normalizedToken = normalizeToken(token || mesaAccessToken.value)
  if (!normalizedToken) return

  try {
    errorMessage.value = ''
    await session.openAnonymousSessionFromQR(normalizedToken)
    router.push('/wallet')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Falha ao iniciar consumo anónimo.'
    console.error('Erro ao iniciar consumo anónimo:', error)
  }
}

async function joinByManualCode() {
  const mesa = identifiedTable.value || await identifyTableCode(manualCode.value)
  if (!mesa?.qrCode) return
  await joinByToken(mesa.qrCode)
}

async function joinAnonymouslyByManualCode() {
  const mesa = identifiedTable.value || await identifyTableCode(manualCode.value)
  if (!mesa?.qrCode) return
  await joinAnonymouslyByToken(mesa.qrCode)
}

async function identifyByManualCode() {
  await identifyTableCode(manualCode.value)
}

onMounted(async () => {
  // Capture QR Token from URL to join the table session
  if (route.query.qr) {
    manualCode.value = String(route.query.qr).toUpperCase()
    if (AuthService.isAuthenticated()) {
      await joinByToken(route.query.qr)
    } else {
      await identifyTableCode(route.query.qr)
    }
  }
})
</script>

<style scoped>
.actions {
  width: 100%;
}

.table-confirmation {
  border: 1px solid var(--primary-color);
  background: rgba(45, 145, 239, 0.1);
  border-radius: 12px;
  padding: 12px;
  text-align: left;
}

.table-confirmation div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.table-confirmation span,
.table-confirmation small {
  color: var(--text-secondary);
}

.entry-actions {
  display: flex;
  flex-direction: column;
}
</style>
