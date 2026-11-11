import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // caminhos relativos: o site funciona em qualquer subpasta (GitHub Pages)
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
