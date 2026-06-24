import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [, , appName, command] = process.argv;
const supportedApps = new Set(["desktop", "web"]);
const supportedCommands = new Set(["dev", "build", "preview", "start"]);

if (!supportedApps.has(appName) || !supportedCommands.has(command)) {
  throw new Error("Usage: node scripts/run-app.mjs <desktop|web> <dev|build|preview|start>");
}

if (command === "start" && appName !== "desktop") {
  throw new Error("Only the desktop app supports start");
}

const appDirectory = path.join(projectDirectory, "apps", appName);
const entry =
  command === "start"
    ? path.join(projectDirectory, "node_modules", "electron", "cli.js")
    : path.join(projectDirectory, "node_modules", "vite-plus", "bin", "vp");
const args = command === "start" ? [appDirectory] : [command];
const child = spawn(process.execPath, [entry, ...args], {
  cwd: appDirectory,
  env: process.env,
  stdio: "inherit",
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
