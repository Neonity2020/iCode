/// <reference types="vite-plus/client" />

type ICodeModelId = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini";

type ICodeDesktopApi = {
  getState: () => Promise<{
    workspace: string;
    launchId: string;
    codex: { state: "starting" | "ready" | "error"; version: string | null; error: string | null };
  }>;
  pickDirectory: () => Promise<string | null>;
  startThread: (payload: { model: ICodeModelId }) => Promise<{ thread: { id: string } }>;
  sendTurn: (payload: {
    threadId: string;
    text: string;
    model: ICodeModelId;
  }) => Promise<{ turn: { id: string } }>;
  interruptTurn: (payload: { threadId: string; turnId: string }) => Promise<unknown>;
  respondToCodex: (payload: {
    id: string | number;
    result: Record<string, unknown>;
  }) => Promise<boolean>;
  onCodexEvent: (
    listener: (
      event:
        | {
            type: "status";
            status: {
              state: "starting" | "ready" | "error";
              version: string | null;
              error: string | null;
            };
          }
        | { type: "notification"; method: string; params: Record<string, unknown> }
        | {
            type: "request";
            request: { id: string | number; method: string; params: Record<string, unknown> };
          }
        | { type: "stderr"; text: string },
    ) => void,
  ) => () => void;
  openExternal: (url: string) => Promise<boolean>;
  revealInFinder: (filePath: string) => Promise<boolean>;
  platform: string;
  ptySpawn: (payload: { cwd?: string; cols?: number; rows?: number; shell?: string }) => Promise<{
    id: string;
  }>;
  ptyWrite: (payload: { id: string; data: string }) => Promise<boolean>;
  ptyResize: (payload: { id: string; cols: number; rows: number }) => Promise<boolean>;
  ptyKill: (payload: { id: string }) => Promise<boolean>;
  onPtyData: (listener: (event: { id: string; data: string }) => void) => () => void;
  onPtyExit: (
    listener: (event: { id: string; exitCode: number; signal?: number }) => void,
  ) => () => void;
  listFs: (payload: { path?: string; depth?: number }) => Promise<{
    root: string;
    truncated: boolean;
    children: Array<{
      name: string;
      path: string;
      type: "file" | "dir";
      children?: Array<{
        name: string;
        path: string;
        type: "file" | "dir";
        children?: unknown[];
      }>;
    }>;
  }>;
};

declare global {
  interface Window {
    icode?: ICodeDesktopApi;
  }
}

export {};
