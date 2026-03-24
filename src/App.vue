<template>
  <div class="app-layout">
    <div class="scrollable-content">
      <router-view />
    </div>
    <BottomNav v-if="showBottomNav" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from './stores/SessionStore'
import BottomNav from './components/BottomNav.vue'

const route = useRoute()
const session = useSessionStore()

const showBottomNav = computed(() => {
  // Hide bottom nav on Home, Payment, and Login if preferred
  const hiddenRoutes = ['home', 'payment', 'login']
  return !hiddenRoutes.includes(String(route.name))
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
