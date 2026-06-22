/// <reference types="vite-plus/client" />

type ICodeDesktopApi = {
  pickDirectory: () => Promise<string | null>;
  openExternal: (url: string) => Promise<boolean>;
  platform: string;
};

declare global {
  interface Window {
    icode?: ICodeDesktopApi;
  }
}

export {};
