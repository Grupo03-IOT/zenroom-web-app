import { defineConfig } from 'vite'

// Reenvía las peticiones de desarrollo y preview al Cloud desplegado en Azure.
const proxy = {
  '/cloud': {
    target: process.env.CLOUD_PROXY_TARGET ?? 'https://cafecito-app.icywater-8ce04e92.northcentralus.azurecontainerapps.io',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/cloud/, ''),
  },
}

export default defineConfig({
  server: { host: '127.0.0.1', proxy },
  preview: { host: '127.0.0.1', proxy },
})
