import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopDirectory = path.join(rootDirectory, "apps", "desktop");
const releaseDirectory = path.join(rootDirectory, "release", "mac-arm64");
const stagingDirectory = path.join(releaseDirectory, "staging");
const iconsetDirectory = path.join(releaseDirectory, "iCode.iconset");
const appBundlePath = path.join(releaseDirectory, "iCode.app");
const stagedAppBundlePath = path.join(stagingDirectory, "iCode.app");
const appResourcesDirectory = path.join(appBundlePath, "Contents", "Resources");
const iconFileName = "iCode.icns";
const iconFilePath = path.join(appResourcesDirectory, iconFileName);
const appResourcesPath = path.join(appBundlePath, "Contents", "Resources", "app");
const appNodeModulesPath = path.join(appResourcesPath, "node_modules");
const nodePtySourceDirectory = path.join(desktopDirectory, "node_modules", "node-pty");
const electronPackageDirectory = path.dirname(require.resolve("electron/package.json"));
const electronTemplatePath = path.join(electronPackageDirectory, "dist", "Electron.app");
const appVersion = JSON.parse(
  await readFile(path.join(rootDirectory, "package.json"), "utf8"),
).version;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with code ${result.status ?? 1}`);
  }
}

async function buildMacIcon() {
  await rm(iconsetDirectory, { recursive: true, force: true });
  await rm(iconFilePath, { force: true });
  run("python3", [
    path.join(rootDirectory, "scripts", "make-macos-icon.py"),
    "--output",
    iconsetDirectory,
  ]);
  run("iconutil", ["-c", "icns", iconsetDirectory, "-o", iconFilePath]);
  await rm(iconsetDirectory, { recursive: true, force: true });
}

async function copyRuntimeAppFiles() {
  await mkdir(appResourcesDirectory, { recursive: true });
  await cp(path.join(desktopDirectory, "dist"), path.join(appResourcesPath, "dist"), {
    recursive: true,
    force: true,
    dereference: true,
  });
  await mkdir(path.join(appResourcesPath, "electron"), { recursive: true });
  await cp(
    path.join(desktopDirectory, "electron", "main.mjs"),
    path.join(appResourcesPath, "electron", "main.mjs"),
  );
  await cp(
    path.join(desktopDirectory, "electron", "preload.cjs"),
    path.join(appResourcesPath, "electron", "preload.cjs"),
  );
  await cp(
    path.join(nodePtySourceDirectory, "lib"),
    path.join(appNodeModulesPath, "node-pty", "lib"),
    {
      recursive: true,
      force: true,
      dereference: true,
    },
  );
  await cp(
    path.join(nodePtySourceDirectory, "build"),
    path.join(appNodeModulesPath, "node-pty", "build"),
    {
      recursive: true,
      force: true,
      dereference: true,
    },
  );
  await cp(
    path.join(nodePtySourceDirectory, "package.json"),
    path.join(appNodeModulesPath, "node-pty", "package.json"),
  );
  await cp(
    path.join(nodePtySourceDirectory, "LICENSE"),
    path.join(appNodeModulesPath, "node-pty", "LICENSE"),
  );
  await cp(
    path.join(nodePtySourceDirectory, "README.md"),
    path.join(appNodeModulesPath, "node-pty", "README.md"),
  );
  await cp(
    path.join(nodePtySourceDirectory, "typings"),
    path.join(appNodeModulesPath, "node-pty", "typings"),
    {
      recursive: true,
      force: true,
      dereference: true,
    },
  );

  const appPackage = {
    name: "@icode/desktop",
    version: appVersion,
    private: true,
    type: "module",
    main: "electron/main.mjs",
  };
  await writeFile(
    path.join(appResourcesPath, "package.json"),
    `${JSON.stringify(appPackage, null, 2)}\n`,
    "utf8",
  );
}

async function setPlistKey(plistPath, key, value) {
  const escapedValue = String(value).replaceAll('"', '\\"');
  run("/usr/libexec/PlistBuddy", ["-c", `Set :${key} "${escapedValue}"`, plistPath], {
    stdio: "pipe",
  });
}

async function addOrSetPlistKey(plistPath, key, value) {
  try {
    await setPlistKey(plistPath, key, value);
  } catch {
    const escapedValue = String(value).replaceAll('"', '\\"');
    run("/usr/libexec/PlistBuddy", ["-c", `Add :${key} string "${escapedValue}"`, plistPath], {
      stdio: "pipe",
    });
  }
}

async function packageMacArm64Dmg() {
  if (process.platform !== "darwin") {
    throw new Error("macOS dmg packaging is only supported on darwin");
  }

  await rm(appBundlePath, { recursive: true, force: true });
  await rm(stagingDirectory, { recursive: true, force: true });
  await rm(path.join(releaseDirectory, `iCode-${appVersion}-mac-arm64.dmg`), { force: true });
  await rm(path.join(releaseDirectory, "release-manifest.json"), { force: true });
  await mkdir(releaseDirectory, { recursive: true });
  await mkdir(stagingDirectory, { recursive: true });

  await cp(electronTemplatePath, appBundlePath, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });
  await copyRuntimeAppFiles();
  await buildMacIcon();

  await addOrSetPlistKey(
    path.join(appBundlePath, "Contents", "Info.plist"),
    "CFBundleDisplayName",
    "iCode",
  );
  await addOrSetPlistKey(
    path.join(appBundlePath, "Contents", "Info.plist"),
    "CFBundleName",
    "iCode",
  );
  await addOrSetPlistKey(
    path.join(appBundlePath, "Contents", "Info.plist"),
    "CFBundleIdentifier",
    "com.zion.icode",
  );
  await addOrSetPlistKey(
    path.join(appBundlePath, "Contents", "Info.plist"),
    "CFBundleShortVersionString",
    appVersion,
  );
  await addOrSetPlistKey(
    path.join(appBundlePath, "Contents", "Info.plist"),
    "CFBundleVersion",
    appVersion,
  );
  await addOrSetPlistKey(
    path.join(appBundlePath, "Contents", "Info.plist"),
    "CFBundleIconFile",
    iconFileName,
  );
  await addOrSetPlistKey(
    path.join(appBundlePath, "Contents", "Info.plist"),
    "CFBundleIconName",
    "iCode",
  );

  run("codesign", ["--force", "--sign", "-", "--timestamp=none", appBundlePath]);

  await cp(appBundlePath, stagedAppBundlePath, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });
  await symlink("/Applications", path.join(stagingDirectory, "Applications"));

  const dmgPath = path.join(releaseDirectory, `iCode-${appVersion}-mac-arm64.dmg`);
  run("hdiutil", [
    "create",
    "-volname",
    "iCode",
    "-srcfolder",
    stagingDirectory,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);

  const manifestPath = path.join(releaseDirectory, "release-manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        appBundlePath,
        stagingDirectory,
        dmgPath,
        appVersion,
        arch: "arm64",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(dmgPath);

  await rm(stagingDirectory, { recursive: true, force: true });
}

await packageMacArm64Dmg();
