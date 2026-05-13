<template>
  <div class="app-layout">
    <div class="scrollable-content">
      <router-view />
    </div>
    <BottomNav v-if="showBottomNav" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from './stores/SessionStore'
import { AuthService } from './services/auth'
import BottomNav from './components/BottomNav.vue'

const route = useRoute()
const session = useSessionStore()

const showBottomNav = computed(() => {
  // Esconde a barra apenas em Login e Pagamento (fluxos de foco total)
  const hiddenRoutes = ['payment', 'login']
  return !hiddenRoutes.includes(String(route.name))
})

// Ao arrancar: restaurar sessão se o cliente já tiver token guardado
onMounted(async () => {
  if (AuthService.isAuthenticated() || session.isActive || session.qrCodeSessao) {
    try {
      await session.fetchCurrentSession({ silent: true })
      session.startBalanceSync()
    } catch {
      // Sessão pode ter expirado, o interceptor do api.js vai tratar o 401
    }
  }
})

watch(
  () => session.isActive,
  (isActive) => {
    if (isActive) {
      session.startBalanceSync()
    } else {
      session.stopBalanceSync()
    }
  }
)

onUnmounted(() => {
  session.stopBalanceSync()
})
</script>

<style>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
}
</style>
