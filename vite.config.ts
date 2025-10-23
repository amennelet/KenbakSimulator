import { defineConfig } from 'vite'

export default defineConfig({
  base: '/KenbakSimulator/', // Chemin de base pour GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Optimisations pour le déploiement
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  server: {
    host: true,
    port: 3000
  }
})