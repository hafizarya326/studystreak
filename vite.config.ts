import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // recharts + react-router + react add up; the app is a local-first SPA so a
    // single vendor chunk keeps first paint simple. Raise the warning threshold.
    chunkSizeWarningLimit: 1200,
  },
})
