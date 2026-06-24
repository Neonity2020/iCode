import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ChevronRight, Folder, FolderOpen, RefreshCw } from "lucide-react";
import type { DirNode, RightSidebarTab } from "../domain/types";
import { compactPath } from "../lib/paths";

type TreeState = {
  loading: boolean;
  root: string;
  truncated: boolean;
  nodes: DirNode[];
  expanded: Set<string>;
  error: string | null;
};

type TreeMenuState = { path: string; x: number; y: number; kind: "file" | "dir" };

type TreeFileBadge = {
  label: string;
  tone: "js" | "css" | "markup" | "json" | "markdown" | "lock" | "generic";
};

type TreeFolderTone =
  | "default"
  | "project"
  | "resources"
  | "settings"
  | "test"
  | "git"
  | "docs"
  | "run"
  | "server"
  | "idea";

function getTreeFileBadge(name: string): TreeFileBadge {
  const lower = name.toLowerCase();
  if (lower === "package.json" || lower.endsWith(".json")) return { label: "{}", tone: "json" };
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass"))
    return { label: "CSS", tone: "css" };
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return { label: "<>", tone: "markup" };
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return { label: "MD", tone: "markdown" };
  if (/\.(mjs|cjs|js|jsx|ts|tsx)$/.test(lower)) {
    return { label: lower.endsWith(".ts") || lower.endsWith(".tsx") ? "TS" : "JS", tone: "js" };
  }
  if (lower.includes("lock")) return { label: "LK", tone: "lock" };
  return { label: "·", tone: "generic" };
}

function getTreeFolderBadge(name: string): TreeFolderTone {
  const lower = name.toLowerCase();
  if (["src", "cmd", "lib", "helpers", "internal", "pkg"].includes(lower)) return "project";
  if (
    ["assets", "resources", "resource", "images", "image", "icons", "templates", "vendor"].includes(
      lower,
    )
  )
    return "resources";
  if (["config", "configs", "settings", ".vscode", ".idea"].includes(lower)) return "settings";
  if (["tests", "test", "testdata"].includes(lower)) return "test";
  if ([".git", "git", ".gitlab", ".github"].includes(lower)) return "git";
  if (["docs", "doc"].includes(lower)) return "docs";
  if (["scripts", "run"].includes(lower)) return "run";
  if (["server", "api", "backend"].includes(lower)) return "server";
  if (["android", "ios", "macos", "windows", "web", "www"].includes(lower)) return "project";
  return "default";
}

type FileTreeTabProps = {
  tab: RightSidebarTab;
  expandedDirs: string[];
  onToggleExpand: (path: string, open: boolean) => void;
};

export function FileTreeTab({ tab, expandedDirs, onToggleExpand }: FileTreeTabProps) {
  const restoredExpanded = useMemo(() => new Set(expandedDirs), [expandedDirs]);
  const [state, setState] = useState<TreeState>({
    loading: true,
    root: tab.cwd ?? "",
    truncated: false,
    nodes: [],
    expanded: restoredExpanded,
    error: null,
  });
  const [menu, setMenu] = useState<TreeMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    window.icode?.listFs({ path: tab.cwd }).then(
      (response) => {
        setState((current) => {
          const expanded = new Set(current.expanded);
          expanded.add(response.root);
          return {
            ...current,
            loading: false,
            root: response.root,
            truncated: response.truncated,
            nodes: response.children,
            expanded,
            error: null,
          };
        });
      },
      (error: unknown) =>
        setState((current) => ({
          ...current,
          loading: false,
          error: String(error instanceof Error ? error.message : error),
        })),
    );
  }, [tab.cwd]);

  useEffect(() => reload(), [reload]);
  useEffect(() => {
    setState((current) => ({ ...current, expanded: restoredExpanded }));
  }, [restoredExpanded]);

  useEffect(() => {
    if (!menu) return;
    const handlePointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const close = () => setMenu(null);
    document.addEventListener("mousedown", handlePointer);
    paneRef.current?.addEventListener("scroll", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      paneRef.current?.removeEventListener("scroll", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  useLayoutEffect(() => {
    if (!menuRef.current || !menu) return;
    const rect = menuRef.current.getBoundingClientRect();
    const x = Math.max(4, Math.min(menu.x, window.innerWidth - rect.width - 4));
    const y = Math.max(4, Math.min(menu.y, window.innerHeight - rect.height - 4));
    menuRef.current.style.left = `${x}px`;
    menuRef.current.style.top = `${y}px`;
  }, [menu]);

  const toggle = useCallback(
    (path: string) => {
      const open = !state.expanded.has(path);
      setState((current) => {
        const expanded = new Set(current.expanded);
        if (open) expanded.add(path);
        else expanded.delete(path);
        return { ...current, expanded };
      });
      onToggleExpand(path, open);
    },
    [onToggleExpand, state.expanded],
  );

  const openContextMenu = useCallback((event: ReactMouseEvent, node: DirNode) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ path: node.path, x: event.clientX, y: event.clientY, kind: node.type });
  }, []);

  return (
    <div className="tree-pane" ref={paneRef}>
      <div className="tree-toolbar">
        <span className="tree-root" title={state.root}>
          {compactPath(state.root) || "/"}
        </span>
        <button className="icon-button" type="button" onClick={reload} aria-label="刷新">
          <RefreshCw size={13} />
        </button>
      </div>
      {state.error && <div className="file-empty">{state.error}</div>}
      {state.loading && <div className="file-empty">加载中…</div>}
      {!state.loading && !state.error && (
        <div className="tree-list">
          {state.nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              expanded={state.expanded}
              depth={0}
              onToggle={toggle}
              onContextMenu={openContextMenu}
            />
          ))}
        </div>
      )}
      {state.truncated && <div className="file-empty">条目过多，已截断显示</div>}
      {menu && (
        <div className="tree-menu" ref={menuRef} role="menu" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            role="menuitem"
            className="tree-menu-item"
            onClick={() => {
              setMenu(null);
              void window.icode?.revealInFinder(menu.path);
            }}
          >
            <FolderOpen size={13} />
            <span>在 Finder 中显示</span>
          </button>
        </div>
      )}
    </div>
  );
}

type TreeNodeProps = {
  node: DirNode;
  expanded: Set<string>;
  depth: number;
  onToggle: (path: string) => void;
  onContextMenu: (event: ReactMouseEvent, node: DirNode) => void;
};

function TreeNode({ node, expanded, depth, onToggle, onContextMenu }: TreeNodeProps) {
  const open = expanded.has(node.path);
  if (node.type === "file") {
    const badge = getTreeFileBadge(node.name);
    return (
      <div
        className="tree-node tree-file"
        style={{ paddingLeft: `${depth * 14}px` }}
        onContextMenu={(event) => onContextMenu(event, node)}
        title={node.path}
      >
        <span className={`tree-file-badge tree-file-badge-${badge.tone}`} aria-hidden="true">
          {badge.label}
        </span>
        <span className="tree-name">{node.name}</span>
      </div>
    );
  }

  const folderTone = getTreeFolderBadge(node.name);
  return (
    <>
      <div
        className="tree-node tree-dir"
        style={{ paddingLeft: `${depth * 14}px` }}
        onContextMenu={(event) => onContextMenu(event, node)}
        title={node.path}
      >
        <button
          type="button"
          className="tree-toggle"
          onClick={() => onToggle(node.path)}
          aria-expanded={open}
        >
          <ChevronRight size={11} className={`tree-chevron ${open ? "open" : ""}`} />
          <span className={`tree-folder-badge tree-folder-badge-${folderTone}`} aria-hidden="true">
            {open ? <FolderOpen size={12} /> : <Folder size={12} />}
          </span>
          <span className="tree-name">{node.name}</span>
        </button>
      </div>
      {open &&
        node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            expanded={expanded}
            depth={depth + 1}
            onToggle={onToggle}
            onContextMenu={onContextMenu}
          />
        ))}
    </>
  );
}
