const DEFAULT_PORTS = {
  desktop: 5173,
  web: 5174,
};

export function getDevPort(target = "desktop") {
  const envName = target === "web" ? "ICODE_WEB_PORT" : "ICODE_DESKTOP_PORT";
  const rawPort = process.env[envName];
  const parsedPort = Number(rawPort);
  if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
    return parsedPort;
  }
  return DEFAULT_PORTS[target] ?? DEFAULT_PORTS.desktop;
}

export function getDevServerUrl(target = "desktop") {
  return `http://127.0.0.1:${getDevPort(target)}`;
}
