import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/main.css'

if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
  await import('./api/mock.js')
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
  window.__pinia = pinia
}

app.mount('#app')
