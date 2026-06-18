import type { ICodeApi } from '../shared/types'

declare global {
  interface Window {
    icode: ICodeApi
  }
}

export {}
