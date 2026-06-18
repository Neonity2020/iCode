import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// Shared resolve alias so `@icode/shared` resolves to its source in both dev and
// production builds, avoiding reliance on node_modules symlinks during Forge packaging.
const sharedAlias = {
  '@icode/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
}

export default defineConfig({
  resolve: { alias: sharedAlias },
})
