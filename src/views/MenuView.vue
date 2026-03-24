<template>
  <div class="menu-view">
    <div class="top-nav">
      <button class="back-btn" @click="$router.back()">&#8592;</button>
      <h3>Cardápio</h3>
    </div>

    <div class="container">
      <div v-if="errorMessage" class="card text-center mb-4" style="border-color: var(--danger-color);">
        <p class="text-danger font-bold mt-2 mb-2">{{ errorMessage }}</p>
        <button class="btn btn-outline" @click="() => window.location.reload()">Tentar Novamente</button>
      </div>

      <div v-else-if="isLoading" class="text-center py-4">
        <p>A carregar o cardápio...</p>
      </div>

      <template v-else>
        <div class="categories mb-4">
        <button 
          v-for="cat in categories" 
          :key="cat.id"
          class="cat-btn"
          :class="{ active: activeCategory === cat.id }"
          @click="activeCategory = cat.id"
        >
          {{ cat.descricao }}
        </button>
      </div>

      <div class="product-list">
        <div class="card product-card" v-for="product in filteredProducts" :key="product.id">
          <div class="product-info">
            <h3 class="mb-2">{{ product.nome }}</h3>
            <p class="mb-2">{{ product.descricao }}</p>
            <span class="text-primary font-bold">Kz {{ product.preco ? product.preco.toFixed(2) : '0.00' }}</span>
          </div>
          <button class="btn btn-primary btn-sm" @click="addToCart(product)">
            Adicionar
          </button>
        </div>
      </div>
      </template>
    </div>
    
    <div v-if="cart.totalItems > 0" class="floating-cart" @click="$router.push('/cart')">
      <span>{{ cart.totalItems }} itens</span>
      <span>Ver Carrinho (Kz {{ typeof cart.totalPrice === 'number' ? cart.totalPrice.toFixed(2) : '0.00' }})</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCartStore } from '../stores/CartStore'
import api from '../services/api'

const cart = useCartStore()

const categories = ref([])
const activeCategory = ref('')
const products = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    // 1. Carregar categorias primeiro
    const resCategorias = await api.get('/public/cardapio/categorias')
    
    // O backend retorna um ApiResponse com { success: true, message: ..., data: [...] }
    const categoriasPayload = resCategorias.data
    const categoriasList = categoriasPayload.data ? categoriasPayload.data : categoriasPayload

    if (Array.isArray(categoriasList)) {
      categories.value = categoriasList.map(c => typeof c === 'string' ? { id: c, descricao: c } : { id: c.id, descricao: c.descricao })
    }

    if (categories.value.length > 0) {
      activeCategory.value = categories.value[0].id
      
      // 2. Carregar produtos
      const resProdutos = await api.get('/public/cardapio')
      const produtosPayload = resProdutos.data
      const produtosList = produtosPayload.data ? produtosPayload.data : produtosPayload
      
      if (Array.isArray(produtosList)) {
        products.value = produtosList
      }
    }
  } catch (error) {
    console.error('Falha ao carregar produtos.', error)
    if (error.response && error.response.status === 401) {
      errorMessage.value = 'A sua sessão expirou ou não tem acesso. Por favor, autentique-se e tente novamente.'
    } else {
      errorMessage.value = 'Houve um erro de ligação ao tentar obter o cardápio. Por favor, verifique a sua internet ou tente novamente mais tarde.'
    }
  } finally {
    isLoading.value = false
  }
})

const filteredProducts = computed(() => {
  return products.value.filter(p => p.categoria === activeCategory.value)
})

function addToCart(product) {
  cart.addItem(product)
}
</script>

<style scoped>
.menu-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.categories {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 8px;
}

.cat-btn {
  background-color: var(--surface-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 20px;
  white-space: nowrap;
  font-weight: 500;
  cursor: pointer;
}

.cat-btn.active {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.product-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-info {
  flex: 1;
}

.font-bold {
  font-weight: bold;
}

.btn-sm {
  width: auto;
  padding: 8px 12px;
  font-size: 14px;
}

.floating-cart {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 448px;
  background-color: var(--primary-color);
  color: white;
  padding: 16px;
  border-radius: var(--border-radius);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  cursor: pointer;
  z-index: 100;
}
</style>
