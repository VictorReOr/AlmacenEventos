import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/AlmacenEventos/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Gestión Visual Almacén',
        short_name: 'Almacén',
        description: 'Aplicación visual para la gestión de ubicaciones del almacén',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'almacenito.png',
            sizes: '192x192', // ideally resize, but using original for now
            type: 'image/png'
          },
          {
            src: 'almacenito.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5200,
    strictPort: false,
  }
}))
