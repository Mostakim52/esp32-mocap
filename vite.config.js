import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Generate self-signed certificate for HTTPS
const https = process.env.HTTPS === 'true' ? {
  key: fs.readFileSync(path.resolve(__dirname, 'certs', 'key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, 'certs', 'cert.pem')),
} : undefined

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Listen on all network interfaces
    port: 5173, // Default Vite port
    https, // Enable HTTPS if HTTPS=true
  },
})
