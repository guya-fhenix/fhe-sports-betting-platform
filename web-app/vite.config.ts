import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/.pnpm/tfhe@*/node_modules/tfhe/tfhe_bg.wasm',
          dest: 'tfhe'
        }
      ]
    }),
    tsconfigPaths()
  ],
  build: { target: 'esnext' },
  optimizeDeps: { 
    esbuildOptions: { target: 'esnext' },
    exclude: ['cofhejs', 'tfhe'],
  },
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      // Some builds need this alias
      'tweetnacl': 'tweetnacl/nacl-fast.js'
    }
  }
})