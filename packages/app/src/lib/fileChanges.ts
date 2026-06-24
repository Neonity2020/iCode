import type { CodexItem, FileChange, FileChangeKind } from "../domain/types";

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" ? (value as RawRecord) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return undefined;
}

function normalizeKind(value: unknown, source: RawRecord): FileChangeKind {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "add" || raw === "delete" || raw === "modify" || raw === "rename") return raw;
  const oldPath = firstString(source.oldPath, source.previousPath, source.fromPath, source.beforePath);
  const newPath = firstString(source.newPath, source.nextPath, source.toPath, source.afterPath);
  if (oldPath && newPath && oldPath !== newPath) return "rename";
  return "modify";
}

function normalizeStatus(value: unknown, fallback: FileChange["status"]): FileChange["status"] {
  const raw = typeof value === "string" ? value : "";
  return raw === "inProgress" || raw === "completed" || raw === "failed" ? raw : fallback;
}

function getChangeEntries(source: unknown): unknown[] {
  if (Array.isArray(source)) return source;
  const record = asRecord(source);
  if (!record) return [];

  const nested = [
    record.files,
    record.changes,
    record.entries,
    record.items,
    record.fileChanges,
    record.changesets,
  ].find(Array.isArray);
  if (Array.isArray(nested)) return nested;

  return [record];
}

function normalizeSingleChange(
  entry: unknown,
  baseId: string,
  index: number,
  status: FileChange["status"],
): FileChange | null {
  const record = asRecord(entry);
  if (!record) return null;
  const entryId =
    asString(record.id) ??
    (index === 0 ? baseId : `${baseId}:${index}`);
  const path =
    firstString(
      record.path,
      record.filePath,
      record.filename,
      record.newPath,
      record.nextPath,
      record.toPath,
    ) ?? "";
  const oldPath = firstString(record.oldPath, record.previousPath, record.fromPath, record.beforePath);
  const newPath = firstString(record.newPath, record.nextPath, record.toPath, record.afterPath);
  const kind = normalizeKind(record.kind ?? record.changeType ?? record.type, record);
  const diff = firstString(record.diff, record.patch, record.unifiedDiff, record.contentDiff) ?? "";
  const summary =
    firstString(record.summary, record.description, record.reason, record.message) ?? undefined;

  return {
    id: entryId,
    path: path || newPath || oldPath || "",
    kind,
    diff,
    status: normalizeStatus(record.status, status),
    ...(oldPath ? { previousPath: oldPath } : {}),
    ...(newPath ? { newPath } : {}),
    ...(summary ? { summary } : {}),
  };
}

export function normalizeFileChangeEntries(item: CodexItem, status: FileChange["status"]) {
  const baseId = asString(item.id);
  if (!baseId) return [];

  const rawSource =
    item.changes && typeof item.changes === "object" ? item.changes : item;
  const entries = getChangeEntries(rawSource);
  return entries.flatMap((entry, index) => {
    const normalized = normalizeSingleChange(entry, baseId, index, status);
    return normalized ? [normalized] : [];
  });
}

export function describeFileChangeItem(item: CodexItem) {
  const entries = normalizeFileChangeEntries(item, "completed");
  if (entries.length === 0) return "";
  if (entries.length === 1) {
    const change = entries[0];
    if (change.kind === "rename" && change.previousPath) {
      return `${change.previousPath} → ${change.path || change.newPath || change.previousPath}`;
    }
    return change.path || change.newPath || change.previousPath || "";
  }
  const first = entries[0];
  const last = entries[entries.length - 1];
  const visible = [first.path || first.newPath || first.previousPath, last.path || last.newPath || last.previousPath]
    .filter((value, index, all): value is string => !!value && all.indexOf(value) === index);
  return visible.length > 0 ? `${visible.join(" · ")} · ${entries.length} 个文件` : `${entries.length} 个文件`;
}

export function getFileChangeTargetPath(change: FileChange) {
  if (change.kind === "rename") {
    return change.path || change.newPath || change.previousPath || "";
  }
  if (change.kind === "delete") {
    return change.previousPath || change.path || "";
  }
  return change.path || change.newPath || change.previousPath || "";
}
