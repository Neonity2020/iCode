import { Check, GitBranch, MoreHorizontal, PanelLeft, PanelRight } from "lucide-react";
import { compactPath } from "../lib/paths";

type TopbarProps = {
  sidebarOpen: boolean;
  rightSidebarOpen: boolean;
  title: string;
  workspacePath: string;
  runtimeLabel: string;
  completedFileChangeCount: number;
  onOpenSidebar: () => void;
  onChooseWorkspace: () => void;
  onToggleRightSidebar: () => void;
};

export function Topbar({
  sidebarOpen,
  rightSidebarOpen,
  title,
  workspacePath,
  runtimeLabel,
  completedFileChangeCount,
  onOpenSidebar,
  onChooseWorkspace,
  onToggleRightSidebar,
}: TopbarProps) {
  return (
    <header className={`topbar ${sidebarOpen ? "" : "topbar-sidebar-collapsed"}`}>
      {!sidebarOpen && (
        <button
          className="icon-button topbar-sidebar-toggle"
          type="button"
          aria-label="展开侧栏"
          onClick={onOpenSidebar}
        >
          <PanelLeft size={17} />
        </button>
      )}
      <div className="title-block">
        <strong>{title}</strong>
        <button
          className="workspace-link"
          type="button"
          onClick={onChooseWorkspace}
          title={workspacePath || "选择工作区"}
        >
          <GitBranch size={13} />
          <span>{compactPath(workspacePath) || "选择工作区"}</span>
        </button>
      </div>
      <div className="topbar-actions">
        <button className="status-pill" type="button">
          <Check size={13} /> {runtimeLabel}
        </button>
        <button
          className="icon-button topbar-toggle"
          type="button"
          aria-label={rightSidebarOpen ? "关闭文件变更" : "打开文件变更"}
          aria-pressed={rightSidebarOpen}
          onClick={onToggleRightSidebar}
        >
          <PanelRight size={17} />
          {completedFileChangeCount > 0 && (
            <span className="topbar-badge">{completedFileChangeCount}</span>
          )}
        </button>
        <button className="icon-button" type="button" aria-label="更多操作">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </header>
  );
}
