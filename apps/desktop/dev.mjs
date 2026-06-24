import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDevServerUrl } from "../../scripts/dev-config.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(desktopDirectory, "../..");
const vitePlusCli = path.join(projectDirectory, "node_modules", "vite-plus", "bin", "vp");
const electronCli = path.join(projectDirectory, "node_modules", "electron", "cli.js");
const children = new Set();
const devServerUrl = getDevServerUrl();
const devEnv = {
  ...process.env,
  VITE_DEV_SERVER_URL: devServerUrl,
};

function run(entry, args, env = process.env) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: desktopDirectory,
    env,
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", (code) => {
    children.delete(child);
    if (code && code !== 0) stop(code);
  });
  return child;
}

function stop(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vite dev server did not start");
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

run(vitePlusCli, ["dev"], devEnv);
await waitForServer(devServerUrl);
run(electronCli, [desktopDirectory], devEnv);
