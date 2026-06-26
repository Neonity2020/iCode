import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopDirectory = path.resolve(currentDirectory, "..");
const projectDirectory = path.resolve(desktopDirectory, "../..");
const windows = new Set();
let selectedWorkspace = projectDirectory;
const appRunId = randomUUID();
const supportedModels = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]);
const defaultSettings = {
  defaultModel: "gpt-5.5",
  codexCliPath: "",
  terminalShell: "",
};
let settingsCache = null;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function normalizeSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const defaultModel =
    typeof source.defaultModel === "string" && supportedModels.has(source.defaultModel)
      ? source.defaultModel
      : defaultSettings.defaultModel;
  return {
    defaultModel,
    codexCliPath: typeof source.codexCliPath === "string" ? source.codexCliPath : "",
    terminalShell: typeof source.terminalShell === "string" ? source.terminalShell : "",
  };
}

async function readSettings() {
  if (settingsCache) return settingsCache;
  try {
    const raw = await readFile(settingsPath(), "utf8");
    settingsCache = normalizeSettings(JSON.parse(raw));
  } catch {
    settingsCache = { ...defaultSettings };
  }
  return settingsCache;
}

async function saveSettings(nextSettings) {
  settingsCache = normalizeSettings(nextSettings);
  await mkdir(path.dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), `${JSON.stringify(settingsCache, null, 2)}\n`, "utf8");
  return settingsCache;
}

function findCodexExecutable() {
  const configuredCodexPath = settingsCache?.codexCliPath?.trim();
  const candidates = [
    configuredCodexPath,
    process.env.CODEX_CLI_PATH,
    ...(process.platform === "darwin"
      ? [
          "/Applications/Codex.app/Contents/Resources/codex",
          path.join(os.homedir(), "Applications/Codex.app/Contents/Resources/codex"),
        ]
      : []),
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "codex") return candidate;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep looking for an executable Codex installation.
    }
  }

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, "codex");
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue searching PATH entries.
    }
  }

  const shells = [process.env.SHELL, "/bin/zsh", "/bin/bash"].filter(Boolean);
  for (const shellPath of shells) {
    const result = spawnSync(shellPath, ["-lc", "command -v codex"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const candidate = result.stdout?.trim();
    if (!result.error && result.status === 0 && candidate) {
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Ignore non-executable results and continue searching.
      }
    }
  }

  return null;
}

function runGit(args) {
  const result = spawnSync("git", ["-C", selectedWorkspace, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  return result.stdout ?? "";
}

function parseGitStatusLine(line) {
  const code = line.slice(0, 2);
  const rawPath = line.slice(3);
  const pathParts = rawPath.split(" -> ");
  const path = pathParts[pathParts.length - 1] ?? "";
  const statusCode = code.trim();
  const kind = statusCode.includes("D")
    ? "delete"
    : statusCode.includes("A") || statusCode === "??"
      ? "add"
      : "modify";
  return { path, kind };
}

function diffForPath(filePath, kind) {
  const args =
    kind === "add"
      ? ["diff", "--no-ext-diff", "--no-color", "--unified=20", "--", "/dev/null", filePath]
      : kind === "delete"
        ? ["diff", "--no-ext-diff", "--no-color", "--unified=20", "--", filePath, "/dev/null"]
        : ["diff", "--no-ext-diff", "--no-color", "--unified=20", "--", filePath];
  const output = runGit(args);
  return output ?? "";
}

function readWorkspaceChanges() {
  const statusOutput = runGit(["status", "--porcelain=v1"]);
  if (statusOutput === null) return [];
  const lines = statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return lines.map((line, index) => {
    const { path: filePath, kind } = parseGitStatusLine(line);
    return {
      path: filePath,
      kind,
      diff: diffForPath(filePath, kind),
      status: "completed",
      id: `workspace:${index}:${filePath}`,
    };
  });
}

class CodexAppServer {
  constructor() {
    this.process = null;
    this.ready = null;
    this.nextRequestId = 1;
    this.pending = new Map();
    this.status = { state: "starting", version: null, error: null };
  }

  emit(message) {
    for (const window of windows) {
      if (!window.isDestroyed()) window.webContents.send("icode:codex-event", message);
    }
  }

  setStatus(state, detail = {}) {
    this.status = { ...this.status, state, ...detail };
    this.emit({ type: "status", status: this.status });
  }

  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const executable = findCodexExecutable();
      if (!executable) {
        const message =
          "找不到 Codex CLI。请安装 Codex CLI，或把可执行文件路径设置到 CODEX_CLI_PATH。";
        this.setStatus("error", { error: message });
        this.ready = null;
        reject(new Error(message));
        return;
      }
      const child = spawn(executable, ["app-server", "--listen", "stdio://"], {
        cwd: selectedWorkspace,
        env: {
          ...process.env,
          CODEX_SQLITE_HOME: path.join(app.getPath("userData"), "codex-state"),
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.process = child;

      child.once("error", (error) => {
        const message = `无法启动 Codex CLI: ${error.message}`;
        this.setStatus("error", { error: message });
        this.ready = null;
        reject(new Error(message));
      });
      child.once("exit", (code, signal) => {
        const message = `Codex CLI 已退出 (${signal ?? code ?? "unknown"})`;
        for (const { reject: rejectRequest } of this.pending.values()) {
          rejectRequest(new Error(message));
        }
        this.pending.clear();
        this.process = null;
        this.ready = null;
        this.setStatus("error", { error: message });
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => this.emit({ type: "stderr", text: chunk }));

      const lines = readline.createInterface({ input: child.stdout });
      lines.on("line", (line) => this.handleLine(line));

      const initializeTimeout = setTimeout(() => {
        const message = "Codex CLI 初始化超时，请检查 CLI 版本和登录状态";
        this.setStatus("error", { error: message });
        child.kill();
        reject(new Error(message));
      }, 15_000);

      this.requestRaw("initialize", {
        clientInfo: { name: "icode", title: "iCode", version: app.getVersion() },
      })
        .then((result) => {
          clearTimeout(initializeTimeout);
          this.notify("initialized", {});
          this.setStatus("ready", { version: result?.userAgent ?? "Codex CLI", error: null });
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(initializeTimeout);
          reject(error);
        });
    });
    return this.ready;
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.emit({ type: "stderr", text: `Codex 返回了无效 JSON: ${line}` });
      return;
    }

    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Codex 请求失败"));
      else request.resolve(message.result);
      return;
    }

    if (message.id !== undefined && message.method) {
      this.emit({ type: "request", request: message });
      return;
    }

    if (message.method)
      this.emit({ type: "notification", method: message.method, params: message.params });
  }

  write(message) {
    if (!this.process?.stdin.writable) throw new Error("Codex CLI 尚未运行");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  requestRaw(method, params) {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++;
      this.pending.set(id, { resolve, reject });
      try {
        this.write({ method, id, params });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async request(method, params) {
    await this.start();
    return this.requestRaw(method, params);
  }

  notify(method, params) {
    this.write({ method, params });
  }

  respond(id, result) {
    this.write({ id, result });
  }

  stop() {
    this.process?.kill();
  }
}

const codex = new CodexAppServer();

// PTY + filesystem state
let ptyModule = null;
let ptyLoadError = null;
const ptyProcesses = new Map(); // ptyId -> IPty
let nextPtyId = 1;
const FS_SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo"]);
const FS_MAX_ENTRIES = 5000;

function broadcastPty(channel, message) {
  for (const window of windows) {
    if (!window.isDestroyed()) window.webContents.send(channel, message);
  }
}

async function loadPty() {
  if (ptyModule || ptyLoadError) return;
  try {
    ptyModule = await import("node-pty");
  } catch (error) {
    ptyLoadError = error;
  }
}

function validateModel(model) {
  if (typeof model !== "string" || !supportedModels.has(model)) {
    throw new Error("不支持的 Codex 模型");
  }
  return model;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: "iCode",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#f6f6f4",
    webPreferences: {
      preload: path.join(currentDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  windows.add(window);
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => windows.delete(window));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) void window.loadURL(developmentUrl);
  else void window.loadFile(path.join(desktopDirectory, "dist", "index.html"));
}

ipcMain.handle("icode:get-state", () => ({
  workspace: selectedWorkspace,
  codex: codex.status,
  launchId: appRunId,
}));

ipcMain.handle("icode:pick-directory", async () => {
  const result = await dialog.showOpenDialog({
    defaultPath: selectedWorkspace,
    properties: ["openDirectory", "createDirectory"],
    title: "选择工作区",
  });
  if (result.canceled) return null;
  selectedWorkspace = result.filePaths[0];
  return selectedWorkspace;
});

ipcMain.handle("icode:codex-start-thread", async (_event, { model } = {}) =>
  codex.request("thread/start", {
    model: validateModel(model),
    cwd: selectedWorkspace,
    sandbox: "workspace-write",
    approvalPolicy: "on-request",
    personality: "pragmatic",
  }),
);

ipcMain.handle("icode:codex-send-turn", async (_event, { threadId, input, model } = {}) => {
  if (typeof threadId !== "string" || !Array.isArray(input) || input.length === 0) {
    throw new Error("无效的 Codex turn 参数");
  }
  if (!input.every((item) => item && typeof item === "object" && typeof item.type === "string")) {
    throw new Error("无效的 Codex turn 输入");
  }
  return codex.request("turn/start", {
    threadId,
    model: validateModel(model),
    cwd: selectedWorkspace,
    input,
  });
});

ipcMain.handle("icode:codex-interrupt", async (_event, { threadId, turnId }) =>
  codex.request("turn/interrupt", { threadId, turnId }),
);

ipcMain.handle("icode:codex-respond", (_event, { id, result }) => {
  if ((typeof id !== "number" && typeof id !== "string") || typeof result !== "object") {
    throw new Error("无效的 Codex 响应");
  }
  codex.respond(id, result);
  return true;
});

ipcMain.handle("icode:open-external", async (_event, url) => {
  if (typeof url !== "string" || !url.startsWith("https://")) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("icode:reveal-in-finder", (_event, filePath) => {
  if (typeof filePath !== "string" || !filePath.trim()) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle(
  "icode:pty-spawn",
  async (_event, { cwd, cols, rows, shell: requestedShell } = {}) => {
    await loadPty();
    if (!ptyModule) throw new Error(ptyLoadError?.message ?? "node-pty 不可用");
    const configuredShell = settingsCache?.terminalShell?.trim();
    const shellName =
      requestedShell ?? (configuredShell || (process.platform === "win32" ? "cmd.exe" : "bash"));
    const shellArgs = process.platform === "win32" ? [] : ["-l"];
    const id = String(nextPtyId++);
    const proc = ptyModule.spawn(shellName, shellArgs, {
      name: "xterm-256color",
      cols: Math.max(2, Number(cols) || 80),
      rows: Math.max(2, Number(rows) || 24),
      cwd: cwd && typeof cwd === "string" ? cwd : process.cwd(),
      env: { ...process.env, TERM: "xterm-256color" },
    });
    ptyProcesses.set(id, proc);
    proc.onData((data) => broadcastPty("icode:pty-data", { id, data }));
    proc.onExit(({ exitCode, signal }) => {
      broadcastPty("icode:pty-exit", { id, exitCode, signal });
      ptyProcesses.delete(id);
    });
    return { id };
  },
);

ipcMain.handle("icode:pty-write", (_event, { id, data } = {}) => {
  const proc = ptyProcesses.get(String(id));
  if (!proc) throw new Error("Unknown pty id");
  proc.write(typeof data === "string" ? data : "");
  return true;
});

ipcMain.handle("icode:pty-resize", (_event, { id, cols, rows } = {}) => {
  const proc = ptyProcesses.get(String(id));
  if (!proc) return false;
  proc.resize(Math.max(2, Number(cols) || 80), Math.max(2, Number(rows) || 24));
  return true;
});

ipcMain.handle("icode:pty-kill", (_event, { id } = {}) => {
  const proc = ptyProcesses.get(String(id));
  if (!proc) return false;
  proc.kill();
  ptyProcesses.delete(String(id));
  return true;
});

ipcMain.handle("icode:fs-list", async (_event, { path: root, depth } = {}) => {
  const start = root && typeof root === "string" ? root : process.cwd();
  const maxDepth = Math.min(Math.max(0, Number(depth) || 12), 16);
  let count = 0;
  const stopped = { value: false };

  async function walk(dir, level) {
    if (stopped.value || count >= FS_MAX_ENTRIES) {
      stopped.value = true;
      return null;
    }
    let entries;
    try {
      const { readdir } = await import("node:fs/promises");
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const children = [];
    for (const entry of entries) {
      if (count >= FS_MAX_ENTRIES) break;
      const childPath = `${dir}${path.sep}${entry.name}`;
      const isDir = entry.isDirectory();
      if (isDir && FS_SKIP.has(entry.name)) continue;
      const node = { name: entry.name, path: childPath, type: isDir ? "dir" : "file" };
      count++;
      if (isDir && level < maxDepth) {
        const nested = await walk(childPath, level + 1);
        if (nested) node.children = nested;
      }
      children.push(node);
    }
    return children;
  }

  const tree = await walk(start, 0);
  return { root: start, truncated: stopped.value, children: tree ?? [] };
});

ipcMain.handle("icode:get-workspace-changes", () => readWorkspaceChanges());

ipcMain.handle("icode:settings-get", () => readSettings());

ipcMain.handle("icode:settings-update", async (_event, patch = {}) => {
  const current = await readSettings();
  const next = await saveSettings({
    ...current,
    ...(patch && typeof patch === "object" ? patch : {}),
  });
  if (next.codexCliPath !== current.codexCliPath && codex.status.state === "error") {
    void codex.start().catch(() => {});
  }
  return next;
});

ipcMain.handle("icode:settings-reset", () => saveSettings(defaultSettings));

app.whenReady().then(async () => {
  await readSettings();
  createWindow();
  void codex.start().catch(() => {});
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  for (const proc of ptyProcesses.values()) {
    try {
      proc.kill();
    } catch {
      // Ignore kill errors during shutdown.
    }
  }
  ptyProcesses.clear();
  codex.stop();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
