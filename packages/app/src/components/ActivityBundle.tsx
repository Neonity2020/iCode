import { Check, FileCode2, TerminalSquare } from "lucide-react";
import type { Activity } from "../domain/types";
import { summarizeActivityBundle, summarizeActivityDetail } from "../lib/codex";

type ActivityBundleProps = {
  activities: Activity[];
  expanded: boolean;
  expandedItems: Record<string, boolean>;
  onToggleBundle: () => void;
  onToggleItem: (id: string, expanded: boolean) => void;
};

export function ActivityBundle({
  activities,
  expanded,
  expandedItems,
  onToggleBundle,
  onToggleItem,
}: ActivityBundleProps) {
  const collapseBoundary = Math.max(0, activities.length - 2);

  return (
    <div className={`activity-bundle ${expanded ? "expanded" : ""}`}>
      <button
        className="activity-bundle-header"
        type="button"
        onClick={onToggleBundle}
        aria-expanded={expanded}
      >
        <div className="activity-icon">
          <FileCode2 size={16} />
        </div>
        <div className="activity-bundle-body">
          <strong>
            执行记录
            <span className="activity-bundle-count">{activities.length} 步</span>
          </strong>
          <span>{summarizeActivityBundle(activities)}</span>
        </div>
        <div className="activity-bundle-meta">
          {activities.some((activity) => activity.status === "inProgress") ? (
            <span className="activity-spinner" />
          ) : (
            <Check size={16} className="activity-check" />
          )}
          <span className="activity-bundle-toggle">{expanded ? "收起" : "展开"}</span>
        </div>
      </button>

      {expanded && (
        <div className="activity-bundle-items">
          {activities.map((activity, index) => {
            const defaultExpanded = activity.status !== "completed" || index >= collapseBoundary;
            const itemExpanded = expandedItems[activity.id] ?? defaultExpanded;
            const detail = activity.detail || "处理中";
            return (
              <div className={`activity-card ${itemExpanded ? "" : "compact"}`} key={activity.id}>
                <div className="activity-icon">
                  {activity.title === "运行命令" ? (
                    <TerminalSquare size={16} />
                  ) : (
                    <FileCode2 size={16} />
                  )}
                </div>
                <div className="activity-body">
                  <strong>{activity.title}</strong>
                  <span>
                    {itemExpanded ? detail : summarizeActivityDetail(detail) || "已收起详情"}
                  </span>
                </div>
                <div className="activity-actions">
                  {activity.status === "inProgress" ? (
                    <span className="activity-spinner" />
                  ) : (
                    <Check size={16} className="activity-check" />
                  )}
                  {activity.status === "completed" && activities.length > 2 && (
                    <button
                      className="activity-collapse-toggle"
                      type="button"
                      onClick={() => onToggleItem(activity.id, !itemExpanded)}
                      aria-expanded={itemExpanded}
                    >
                      {itemExpanded ? "收起" : "展开"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
