<template>
  <div class="login-view">
    <div class="top-nav">
      <button class="back-btn" @click="$router.push('/menu')">&#8592; Voltar</button>
      <h3>Autenticação</h3>
    </div>

    <div class="container d-flex flex-column" style="margin-top: 40px;">
      <div v-if="errorMessage" class="alert alert-danger mb-4 p-3 rounded text-center">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert-success mb-4 p-3 rounded text-center" style="background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;">
        {{ successMessage }}
      </div>

      <!-- Passo 1: Solicitar OTP -->
      <div v-if="!stepOtp" class="card text-center">
        <h2 class="text-primary mb-2">Login do Cliente</h2>
        <p class="mb-4">Insira o seu número de telefone para receber o código de acesso.</p>
        
        <input 
          type="tel" 
          v-model="phoneNumber" 
          placeholder="Ex: 925813939" 
          class="form-control mb-4" 
          style="padding: 15px; font-size: 18px; text-align: center; border-radius: 8px; border: 1px solid #ccc; width: 100%;"
          :disabled="isLoading"
        />

        <button 
          class="btn btn-primary" 
          style="width: 100%; padding: 15px; font-size: 16px;" 
          @click="requestOtp" 
          :disabled="isLoading || !phoneNumber"
        >
          {{ isLoading ? 'A processar...' : 'Receber Código' }}
        </button>
      </div>

      <!-- Passo 2: Validar OTP -->
      <div v-else class="card text-center">
        <h2 class="text-primary mb-2">Código de Acesso</h2>
        <p class="mb-4">Foi enviado um código para <strong>{{ phoneNumber }}</strong>. Insira-o abaixo.</p>
        
        <div class="d-flex justify-content-center mb-4" style="gap: 15px;">
          <input 
            v-for="(digit, index) in otpDigits" 
            :key="index"
            type="text" 
            inputmode="numeric"
            maxlength="1"
            v-model="otpDigits[index]"
            @input="onOtpInput(index, $event)"
            @keydown.delete="onOtpDelete(index, $event)"
            @paste.prevent="onOtpPaste"
            ref="otpInputRefs"
            class="form-control otp-input" 
            :disabled="isLoading"
          />
        </div>

        <button 
          class="btn btn-primary mb-3" 
          style="width: 100%; padding: 15px; font-size: 16px;" 
          @click="validateOtp" 
          :disabled="isLoading || otpCode.length !== 4"
        >
          {{ isLoading ? 'A validar...' : 'Entrar na Sessão' }}
        </button>

        <button 
          class="btn btn-outline" 
          style="width: 100%;" 
          @click="resetStep" 
          :disabled="isLoading"
        >
          Mudar número
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { AuthService } from '../services/auth'

const router = useRouter()
const route = useRoute()

const phoneNumber = ref('')
const otpDigits = ref(['', '', '', ''])
const otpInputRefs = ref([])
const otpCode = computed(() => otpDigits.value.join(''))
const stepOtp = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function requestOtp() {
  errorMessage.value = ''
  successMessage.value = ''
  
  if (!phoneNumber.value || phoneNumber.value.length < 9) {
    errorMessage.value = 'Por favor, insira um número válido.'
    return
  }

  isLoading.value = true
  try {
    const response = await AuthService.requestOtp(phoneNumber.value)
    successMessage.value = response.message || 'Código enviado com sucesso!'
    stepOtp.value = true
  } catch (error) {
    console.error('Falha ao solicitar OTP:', error)
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage.value = error.response.data.message
    } else {
      errorMessage.value = 'Houve um erro de servidor ao solicitar o seu código.'
    }
  } finally {
    isLoading.value = false
  }
}

async function validateOtp() {
  errorMessage.value = ''
  successMessage.value = ''
  
  const codeStr = String(otpCode.value)
  if (!codeStr || codeStr.length !== 4) {
    errorMessage.value = 'O código OTP deve ter exatamente 4 dígitos.'
    return
  }

  isLoading.value = true
  try {
    const success = await AuthService.validateOtp(phoneNumber.value, otpCode.value)
    if (success) {
      // Return to the previous page that requested auth or go to dashboard
      const redirectPath = route.query.redirect || '/dashboard'
      router.push(redirectPath)
    } else {
      errorMessage.value = 'Privilégios insuficientes ou código inválido.'
    }
  } catch (error) {
    console.error('Falha ao validar OTP:', error)
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage.value = error.response.data.message
    } else {
      errorMessage.value = 'Código inválido ou expirado.'
    }
  } finally {
    isLoading.value = false
  }
}

function resetStep() {
  stepOtp.value = false
  otpDigits.value = ['', '', '', '']
  errorMessage.value = ''
  successMessage.value = ''
}

function onOtpInput(index, event) {
  const value = event.target.value
  
  if (value && !/^\d$/.test(value)) {
    otpDigits.value[index] = ''
    return
  }

  if (value && index < 3) {
    // Vue refs within v-for are arrays, use the index directly
    if (otpInputRefs.value[index + 1]) {
      otpInputRefs.value[index + 1].focus()
    }
  }
}

function onOtpDelete(index, event) {
  if (!otpDigits.value[index] && index > 0) {
    if (otpInputRefs.value[index - 1]) {
      otpInputRefs.value[index - 1].focus()
    }
  }
}

function onOtpPaste(event) {
  const paste = (event.clipboardData || window.clipboardData).getData('text')
  const numbers = paste.replace(/\D/g, '').split('').slice(0, 4)
  
  if (numbers.length > 0) {
    numbers.forEach((num, index) => {
      otpDigits.value[index] = num
    })
    
    const focusIndex = Math.min(numbers.length, 3)
    if (otpInputRefs.value[focusIndex]) {
      // Small timeout to allow v-model to update before focusing next one
      setTimeout(() => {
        otpInputRefs.value[focusIndex].focus()
      }, 50)
    }
  }
}
</script>

<style scoped>
.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

.otp-input {
  width: 60px;
  height: 60px;
  font-size: 28px;
  font-weight: bold;
  text-align: center;
  border-radius: 8px;
  border: 1px solid #ccc;
  padding: 0;
  color: var(--primary-color, #007aff);
}
</style>
