const DEFAULT_DEV_PORT = 5173;

export function getDevPort() {
  const rawPort = process.env.VITE_DEV_PORT;
  const parsedPort = Number(rawPort);
  if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
    return parsedPort;
  }
  return DEFAULT_DEV_PORT;
}

export function getDevServerUrl() {
  return `http://127.0.0.1:${getDevPort()}`;
}
