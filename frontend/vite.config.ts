import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_BASE in GitHub Actions to the repo path (e.g., "/ppt-tool/").
// Default '/' works for local dev and custom-domain deployment.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})
