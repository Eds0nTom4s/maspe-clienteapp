<template>
  <div class="sensitive-balance">
    <component
      :is="headingTag"
      class="balance-value"
      :class="valueClass"
    >
      {{ displayedBalance }}
    </component>
    <button
      class="visibility-toggle"
      type="button"
      :aria-label="visible ? 'Ocultar saldo' : 'Mostrar saldo'"
      :title="visible ? 'Ocultar saldo' : 'Mostrar saldo'"
      @click="visible = !visible"
    >
      <svg v-if="visible" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
        <path d="M9.9 5.2A10.3 10.3 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-3 3.9" />
        <path d="M6.6 6.9C3.7 8.7 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.3 3.7-.8" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  amount: {
    type: Number,
    default: 0
  },
  headingTag: {
    type: String,
    default: 'h1'
  },
  valueClass: {
    type: String,
    default: 'text-success'
  }
})

const visible = ref(false)

const displayedBalance = computed(() => {
  if (!visible.value) return 'Kz ****'
  return `Kz ${Number(props.amount || 0).toFixed(2)}`
})
</script>

<style scoped>
.sensitive-balance {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.balance-value {
  margin-top: 0;
  margin-bottom: 0;
}

.visibility-toggle {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-color-light);
  color: var(--text-secondary);
  cursor: pointer;
}

.visibility-toggle:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.visibility-toggle svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
