import { Check, LocateFixed } from "lucide-react";
import type { FileChange } from "../domain/types";
import { getFileChangeTargetPath } from "../lib/fileChanges";

type FileChangesPanelProps = {
  changes: FileChange[];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onLocate?: (change: FileChange) => void;
};

export function FileChangesPanel({ changes, expanded, onToggle, onLocate }: FileChangesPanelProps) {
  if (changes.length === 0) return <div className="file-empty">暂无文件变更</div>;

  return changes.map((change) => {
    const isOpen = !!expanded[change.id];
    const lines = change.diff ? change.diff.split("\n") : [];
    const kindLabel =
      change.kind === "add"
        ? "A"
        : change.kind === "delete"
          ? "D"
          : change.kind === "rename"
            ? "R"
            : "M";
    const displayPath =
      change.kind === "rename" &&
      change.previousPath &&
      change.path &&
      change.previousPath !== change.path
        ? `${change.previousPath} → ${change.path}`
        : change.path || change.newPath || change.previousPath || "(未知路径)";
    const locatePath = getFileChangeTargetPath(change);
    return (
      <div key={change.id} className={`file-row kind-${change.kind} status-${change.status}`}>
        <div className="file-row-header">
          <span className={`file-kind file-kind-${change.kind}`}>{kindLabel}</span>
          <button
            className="file-row-main"
            type="button"
            onClick={() => onToggle(change.id)}
            aria-expanded={isOpen}
          >
            <span className="file-path" title={displayPath}>
              {displayPath}
            </span>
            {change.summary && (
              <span className="file-summary" title={change.summary}>
                {change.summary}
              </span>
            )}
            {!change.summary && change.kind === "rename" && (
              <span className="file-summary" title="重命名文件">
                重命名
              </span>
            )}
          </button>
          {onLocate && locatePath && (
            <button
              className="file-locate"
              type="button"
              title="在文件树中定位"
              aria-label="在文件树中定位"
              onClick={() => onLocate(change)}
            >
              <LocateFixed size={12} />
              <span>定位</span>
            </button>
          )}
          {change.status === "inProgress" ? (
            <span className="activity-spinner" />
          ) : change.status === "failed" ? (
            <span className="file-failed">失败</span>
          ) : (
            <Check size={13} className="activity-check" />
          )}
        </div>
        {isOpen && (
          <pre className="file-diff">
            {lines.length === 0 ? (
              <span className="file-diff-empty">无 diff 预览（可能被截断）</span>
            ) : (
              lines.map((line, index) => (
                <span
                  key={index}
                  className={
                    line.startsWith("+") && !line.startsWith("+++")
                      ? "diff-add"
                      : line.startsWith("-") && !line.startsWith("---")
                        ? "diff-remove"
                        : "diff-ctx"
                  }
                >
                  {line || " "}
                </span>
              ))
            )}
          </pre>
        )}
      </div>
    );
  });
}
