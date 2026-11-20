import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const PREVIEW_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=(), fullscreen=(self)',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob: https:; connect-src 'self'; frame-src https://open.spotify.com https://www.spotify.com; worker-src 'none'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    headers: PREVIEW_SECURITY_HEADERS,
  },
  build: {
    // recharts + react-router + react add up; the app is a local-first SPA so a
    // single vendor chunk keeps first paint simple. Raise the warning threshold.
    chunkSizeWarningLimit: 1200,
  },
})
