import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// identificador desta publicação; o app compara com versao.json para saber se saiu versão nova
const versao = String(Date.now())

export default defineConfig({
  // caminhos relativos: o site funciona em qualquer subpasta (GitHub Pages)
  base: './',
  define: { __VERSAO__: JSON.stringify(versao) },
  plugins: [
    react(),
    {
      name: 'versao-publicada',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao }) })
      },
    },
  ],
  server: { port: 5173, strictPort: true },
})
