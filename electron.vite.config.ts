import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/main.ts'),
        },
      },
      outDir: path.resolve(__dirname, 'out/main'),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          preload: path.resolve(__dirname, 'electron/preload.ts'),
        },
      },
      outDir: path.resolve(__dirname, 'out/preload'),
    },
  },
  renderer: {
    root: path.resolve(__dirname, 'src'),
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/index.html'),
        },
      },
      outDir: path.resolve(__dirname, 'out/renderer'),
    },
  },
})
