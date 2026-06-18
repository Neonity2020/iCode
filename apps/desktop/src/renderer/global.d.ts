import type { ICodeApi } from '@icode/shared'

declare global {
  interface Window {
    icode: ICodeApi
  }
}

export {}
