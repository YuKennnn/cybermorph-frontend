import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/main.css'

if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
  import('./api/mock')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
