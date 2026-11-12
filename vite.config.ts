import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/cloud': {
      target: mode === 'iot-local'
        ? 'http://127.0.0.1:8080'
        : env.CLOUD_PROXY_TARGET || 'https://cafecito-app.icywater-8ce04e92.northcentralus.azurecontainerapps.io',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/cloud/, ''),
    },
  }
  return {
    server: { host: '127.0.0.1', proxy },
    preview: { host: '127.0.0.1', proxy },
  }
})
