import { FolderTree, Plus, TerminalSquare, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FileChange, RightSidebarTab, RightSidebarTabKind } from "../domain/types";
import { FileChangesPanel } from "./FileChangesPanel";
import { FileTreeTab } from "./FileTreeTab";
import { TerminalTab } from "./TerminalTab";
import { usePlatform } from "../platform/PlatformContext";

type RightSidebarProps = {
  tabs: RightSidebarTab[];
  activeTabId: string;
  fileChanges: FileChange[];
  expandedFiles: Record<string, boolean>;
  expandedDirs: string[];
  onSelectTab: (id: string) => void;
  onAddTab: (kind: RightSidebarTabKind) => void;
  onCloseTab: (id: string) => void;
  onToggleFile: (id: string) => void;
  onToggleDirectory: (path: string, open: boolean) => void;
};

export function RightSidebar({
  tabs,
  activeTabId,
  fileChanges,
  expandedFiles,
  expandedDirs,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onToggleFile,
  onToggleDirectory,
}: RightSidebarProps) {
  const platform = usePlatform();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [addMenuOpen]);

  return (
    <aside className="right-sidebar" aria-label="侧边面板">
      <div className="tab-bar">
        <div className="tab-strip" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={tab.id === activeTabId}
              className={`tab-strip-item ${tab.id === activeTabId ? "active" : ""}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <span className="tab-strip-title">{tab.title}</span>
              {tab.kind !== "files" && (
                <span
                  className="tab-strip-close"
                  role="button"
                  aria-label={`关闭 ${tab.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  <X size={11} />
                </span>
              )}
            </button>
          ))}
        </div>
        {(platform.capabilities.fileSystem || platform.capabilities.terminal) && (
          <div className="tab-add-wrap" ref={addMenuRef}>
            <button
              className="tab-add"
              type="button"
              aria-label="新建侧边栏标签页"
              title="新建侧边栏标签页"
              aria-expanded={addMenuOpen}
              onClick={() => setAddMenuOpen((open) => !open)}
            >
              <Plus size={13} />
            </button>
            {addMenuOpen && (
              <div className="tab-add-menu" role="menu">
                {platform.capabilities.fileSystem && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      onAddTab("tree");
                      setAddMenuOpen(false);
                    }}
                  >
                    <FolderTree size={13} /> <span>文件树</span>
                  </button>
                )}
                {platform.capabilities.terminal && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      onAddTab("terminal");
                      setAddMenuOpen(false);
                    }}
                  >
                    <TerminalSquare size={13} /> <span>终端</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="tab-content">
        {!activeTab ? (
          <div className="file-empty">点击 + 添加一个标签页</div>
        ) : activeTab.kind === "files" ? (
          <>
            <div className="files-header">
              <span className="files-title">文件变更</span>
              <small>{fileChanges.length} 个</small>
            </div>
            <div className="file-list">
              <FileChangesPanel
                changes={fileChanges}
                expanded={expandedFiles}
                onToggle={onToggleFile}
              />
            </div>
          </>
        ) : activeTab.kind === "terminal" ? (
          <TerminalTab tab={activeTab} />
        ) : (
          <FileTreeTab
            tab={activeTab}
            expandedDirs={expandedDirs}
            onToggleExpand={onToggleDirectory}
          />
        )}
      </div>
    </aside>
  );
}
