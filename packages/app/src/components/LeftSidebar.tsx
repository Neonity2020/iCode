import { ChevronDown, Code2, PanelLeft, Plus, Search, Settings, Trash2 } from "lucide-react";
import type { RuntimeStatus, Session } from "../domain/types";
import { compactPath } from "../lib/paths";

type LeftSidebarProps = {
  sessions: Session[];
  activeSessionId: number;
  workspacePath: string;
  runtime: RuntimeStatus;
  runtimeLabel: string;
  onChooseWorkspace: () => void;
  onCollapse: () => void;
  onCreateSession: () => void;
  onSelectSession: (id: number) => void;
  onDeleteSession: (id: number) => void;
  onOpenSettings: () => void;
};

export function LeftSidebar({
  sessions,
  activeSessionId,
  workspacePath,
  runtime,
  runtimeLabel,
  onChooseWorkspace,
  onCollapse,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
}: LeftSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="traffic-light-space" />
      <div className="workspace-row">
        <button className="workspace-button" type="button" onClick={onChooseWorkspace}>
          <span className="workspace-icon">
            <Code2 size={15} />
          </span>
          <span>{compactPath(workspacePath) || "选择工作区"}</span>
          <ChevronDown size={14} />
        </button>
        <button className="icon-button" type="button" aria-label="收起侧栏" onClick={onCollapse}>
          <PanelLeft size={16} />
        </button>
      </div>

      <button className="new-task" type="button" onClick={onCreateSession}>
        <Plus size={16} />
        <span>新任务</span>
        <kbd>⌘ N</kbd>
      </button>
      <button className="search-button" type="button">
        <Search size={15} />
        <span>搜索任务</span>
        <kbd>⌘ K</kbd>
      </button>

      <div className="sidebar-label">当前运行</div>
      <nav className="session-list" aria-label="任务">
        {sessions.map((session) => (
          <div
            className={`session-item ${activeSessionId === session.id ? "active" : ""}`}
            key={session.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectSession(session.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectSession(session.id);
              }
            }}
          >
            <span className="session-copy">
              <strong>{session.title}</strong>
              <small>{session.detail}</small>
            </span>
            <span className="session-meta">
              <span className="session-time">{session.time}</span>
              <button
                className="session-delete"
                type="button"
                aria-label={`删除任务：${session.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteSession(session.id);
                }}
              >
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" onClick={onOpenSettings}>
          <Settings size={16} />
          <span>设置</span>
        </button>
        <div
          className={`runtime-status ${runtime.state}`}
          title={runtime.error ?? runtime.version ?? ""}
        >
          <span /> {runtimeLabel}
        </div>
      </div>
    </aside>
  );
}
