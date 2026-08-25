import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

if (import.meta.env.DEV) {
  import('./api/mock')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
