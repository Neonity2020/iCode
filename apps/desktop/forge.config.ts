import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { MakerDeb } from '@electron-forge/maker-deb'
import { VitePlugin } from '@electron-forge/plugin-vite'

const config: ForgeConfig = {
  packagerConfig: { asar: true },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({}),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/main.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/preload/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
  ],
}

export default config
