import type { ICodePlatformApi } from "@icode/platform";

const unsupportedMessage = "Web 端 Codex 服务尚未配置";

function unsupported(): never {
  throw new Error(unsupportedMessage);
}

export const webPlatform: ICodePlatformApi = {
  kind: "web",
  capabilities: {
    localWorkspace: false,
    fileSystem: false,
    terminal: false,
  },
  platform: "web",
  getState: async () => ({
    workspace: "Web workspace",
    launchId: "web-local",
    codex: {
      state: "error",
      version: null,
      error: unsupportedMessage,
    },
  }),
  pickDirectory: async () => null,
  startThread: async () => unsupported(),
  sendTurn: async () => unsupported(),
  interruptTurn: async () => unsupported(),
  respondToCodex: async () => unsupported(),
  onCodexEvent: () => () => {},
  openExternal: async (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  },
  revealInFinder: async () => false,
  ptySpawn: async () => unsupported(),
  ptyWrite: async () => unsupported(),
  ptyResize: async () => unsupported(),
  ptyKill: async () => false,
  onPtyData: () => () => {},
  onPtyExit: () => () => {},
  listFs: async () => unsupported(),
};
