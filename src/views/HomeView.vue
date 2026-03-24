<template>
  <div class="container text-center" style="justify-content: center;">
    <div style="margin-bottom: 40px;">
      <h1>Bem-vindo ao</h1>
      <h2 class="text-primary">{{ session.localName }}</h2>
      <p>Mesa {{ session.tableNumber || 'Não identificada' }}</p>
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
import { onMounted, ref } from 'vue'
import { useSessionStore } from '../stores/SessionStore'
import { useRoute } from 'vue-router'

const session = useSessionStore()
const route = useRoute()
const errorMessage = ref('')

onMounted(async () => {
  // Capture QR Token from URL to join the table session
  if (route.query.qr) {
    try {
      await session.openSessionFromQR(route.query.qr)
      console.log('Sessão vinculada com sucesso via QR Code!')
    } catch (error) {
      errorMessage.value = error.response?.data?.message || 'Falha ao processar o QR Code da mesa.'
      console.error('Erro na leitura do QR:', error)
    }
  }
})
</script>

<style scoped>
.actions {
  width: 100%;
}
</style>
