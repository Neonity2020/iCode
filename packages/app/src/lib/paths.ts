export function compactPath(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

export function getPathAncestors(value: string) {
  const normalized = value.trim();
  if (!normalized) return [];

  const separator = normalized.includes("\\") && !normalized.includes("/") ? "\\" : "/";
  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return [];

  const startsWithSlash = normalized.startsWith("/");
  const hasDriveRoot = /^[A-Za-z]:[\\/]/.test(normalized);
  const rootPrefix = startsWithSlash ? separator : hasDriveRoot ? `${parts[0]}${separator}` : "";
  const startIndex = hasDriveRoot ? 1 : 0;

  const ancestors: string[] = [];
  let current = rootPrefix || parts[0];
  for (let index = startIndex; index < parts.length; index++) {
    if (index === startIndex) {
      current = rootPrefix ? `${rootPrefix}${parts[index]}` : parts[index];
    } else {
      current = `${current}${separator}${parts[index]}`;
    }
    ancestors.push(current);
  }
  return ancestors;
}
