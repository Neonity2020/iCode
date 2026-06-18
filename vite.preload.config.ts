import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const sharedAlias = {
  '@icode/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
}

export default defineConfig({
  resolve: { alias: sharedAlias },
})
