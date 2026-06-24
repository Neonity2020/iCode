import { Check } from "lucide-react";
import type { FileChange } from "../domain/types";

type FileChangesPanelProps = {
  changes: FileChange[];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
};

export function FileChangesPanel({ changes, expanded, onToggle }: FileChangesPanelProps) {
  if (changes.length === 0) return <div className="file-empty">暂无文件变更</div>;

  return changes.map((change) => {
    const isOpen = !!expanded[change.id];
    const lines = change.diff ? change.diff.split("\n") : [];
    const kindLabel = change.kind === "add" ? "A" : change.kind === "delete" ? "D" : "M";
    return (
      <div key={change.id} className={`file-row kind-${change.kind} status-${change.status}`}>
        <button
          className="file-row-header"
          type="button"
          onClick={() => onToggle(change.id)}
          aria-expanded={isOpen}
        >
          <span className={`file-kind file-kind-${change.kind}`}>{kindLabel}</span>
          <span className="file-path" title={change.path}>
            {change.path || "(未知路径)"}
          </span>
          {change.status === "inProgress" ? (
            <span className="activity-spinner" />
          ) : change.status === "failed" ? (
            <span className="file-failed">失败</span>
          ) : (
            <Check size={13} className="activity-check" />
          )}
        </button>
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
