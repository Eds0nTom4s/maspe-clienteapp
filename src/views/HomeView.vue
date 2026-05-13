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
      <p class="text-secondary mb-6">Digite a referência ou o código QR impresso na mesa.</p>
      <div class="input-wrapper mb-4">
        <input
          v-model="manualCode"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          maxlength="20"
          placeholder="Ex: MASPE-MESA-0001"
          class="pro-input"
          :disabled="session.isLoading"
          @keyup.enter="joinByManualCode"
        />
        <button class="qr-scan-btn" @click="startScanning" title="Escanear QR Code">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <rect x="7" y="7" width="3" height="3"></rect>
            <rect x="14" y="7" width="3" height="3"></rect>
            <rect x="7" y="14" width="3" height="3"></rect>
            <rect x="14" y="14" width="3" height="3"></rect>
          </svg>
        </button>
      </div>

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

    <!-- Modal Scanner QR -->
    <div v-if="isScanning" class="scanner-modal">
      <div class="scanner-header">
        <h3 style="color: white; margin: 0;">Escaneie o QR da Mesa</h3>
        <button class="close-btn" @click="stopScanning">✕</button>
      </div>
      <div class="scanner-container">
        <qrcode-stream @detect="onDetect" @error="onScannerError"></qrcode-stream>
      </div>
      <p style="color: white; padding: 16px; margin: 0;">Aponte a câmera para o QR Code impresso na mesa.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { QrcodeStream } from 'vue-qrcode-reader'
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
const isScanning = ref(false)

const mesaAccessToken = computed(() => identifiedTable.value?.qrCode || normalizeToken(manualCode.value, false))
const mesaIdentificadaLabel = computed(() => {
  if (session.tableNumber) return `Mesa ${session.tableNumber}`
  if (identifiedTable.value?.referencia) return `Mesa ${identifiedTable.value.referencia}`
  return 'Mesa não identificada'
})

/**
 * Normaliza o código introduzido pelo utilizador, removendo espaços e passando para maiúsculas.
 * @param {string} token - O código ou token a normalizar.
 * @param {boolean} setError - Define se deve exibir erro caso o token seja inválido/vazio.
 * @returns {string|null} Retorna o token normalizado ou null se inválido.
 */
function normalizeToken(token, setError = true) {
  const normalizedToken = String(token || '').trim().toUpperCase()
  if (!normalizedToken) {
    if (setError) errorMessage.value = 'Informe o código da mesa.'
    return null
  }
  return normalizedToken
}

// Limpa o estado da mesa identificada sempre que o utilizador altera o input
watch(manualCode, () => {
  identifiedTable.value = null
  errorMessage.value = ''
})

/**
 * Identifica uma mesa consultando a API (usando o método do SessionStore ou diretamente).
 * É o primeiro passo para saber se o código inserido corresponde a uma mesa válida no backend.
 * @param {string} code - O código de referência da mesa.
 * @returns {Object|null} Os dados da mesa se encontrada, ou null.
 */
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

/**
 * Método de fallback para identificar a mesa caso o método na SessionStore não esteja disponível.
 * @param {string} normalizedCode - O código da mesa já validado e normalizado.
 * @returns {Object} Dados da mesa retornados pela API.
 */
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

/**
 * Tenta juntar o utilizador à sessão da mesa identificada, mas exige autenticação via telefone.
 * Se o utilizador não estiver autenticado, redireciona para a página de login.
 * @param {string} token - O QR code ou token associado à mesa.
 */
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

/**
 * Tenta juntar o utilizador à sessão da mesa de forma anónima (sem fazer login).
 * Em caso de sucesso, redireciona para a vista de Carteira (WalletView) para gerir saldos pré-pagos.
 * @param {string} token - O QR code ou token associado à mesa.
 */
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

/**
 * Acionado ao clicar em "Entrar com telefone". 
 * Verifica se a mesa já está identificada; se não estiver, identifica-a e depois vincula à sessão.
 */
async function joinByManualCode() {
  const mesa = identifiedTable.value || await identifyTableCode(manualCode.value)
  if (!mesa?.qrCode) return
  await joinByToken(mesa.qrCode)
}

/**
 * Acionado ao clicar em "Consumir anonimamente". 
 * Verifica se a mesa já está identificada; se não estiver, identifica-a e inicia a sessão anónima.
 */
async function joinAnonymouslyByManualCode() {
  const mesa = identifiedTable.value || await identifyTableCode(manualCode.value)
  if (!mesa?.qrCode) return
  await joinAnonymouslyByToken(mesa.qrCode)
}

/**
 * Acionado pelo botão principal de "Identificar mesa".
 * Apenas consulta a API para ver os detalhes da mesa, expondo depois os botões de ação final.
 */
async function identifyByManualCode() {
  await identifyTableCode(manualCode.value)
}

function startScanning() {
  isScanning.value = true
  errorMessage.value = ''
}

function stopScanning() {
  isScanning.value = false
}

async function onDetect(detectedCodes) {
  if (detectedCodes && detectedCodes.length > 0) {
    const rawValue = detectedCodes[0].rawValue
    stopScanning()
    manualCode.value = rawValue
    await identifyByManualCode()
  }
}

function onScannerError(error) {
  stopScanning()
  if (error.name === 'NotAllowedError') {
    errorMessage.value = 'Permissão de câmera negada. Digite o código manualmente.'
  } else {
    errorMessage.value = 'Erro ao iniciar a câmera: ' + error.message
  }
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

.input-wrapper {
  position: relative;
  width: 100%;
}

.qr-scan-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--primary-color);
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.qr-scan-btn:hover, .qr-scan-btn:active {
  background-color: rgba(37, 140, 244, 0.1);
}

.pro-input {
  width: 100%;
  padding: 16px 50px 16px 20px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 2px;
  text-align: center;
  text-transform: uppercase;
  color: var(--text-primary);
  background-color: var(--surface-color-light);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  outline: none;
  transition: all 0.3s ease;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pro-input::placeholder {
  color: var(--text-secondary);
  font-weight: 400;
  letter-spacing: normal;
  opacity: 0.7;
}

.pro-input:focus {
  border-color: var(--primary-color);
  background-color: var(--surface-color);
  box-shadow: 0 0 0 4px rgba(37, 140, 244, 0.15);
}

.pro-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scanner-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #111;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
}

.scanner-container {
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
}
</style>
