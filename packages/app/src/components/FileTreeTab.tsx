import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  ChevronRight,
  Braces,
  FileArchive,
  FileCog,
  FileImage,
  FileLock2,
  FileTerminal,
  FileText,
  FolderOpen,
  Hash,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { DirNode, RightSidebarTab } from "../domain/types";
import { compactPath, getPathAncestors } from "../lib/paths";
import { usePlatform } from "../platform/PlatformContext";

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
  tone:
    | "react"
    | "ts"
    | "css"
    | "json"
    | "markdown"
    | "html"
    | "pnpm"
    | "bun"
    | "vite"
    | "lock"
    | "image"
    | "archive"
    | "config"
    | "terminal"
    | "generic";
  label?: string;
  icon?: ReactNode;
};

function getTreeFileBadge(name: string): TreeFileBadge {
  const lower = name.toLowerCase();
  if (lower === "app.tsx" || lower === "main.tsx")
    return { tone: "react", icon: <ReactLogoIcon /> };
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx"))
    return { tone: "react", icon: <ReactLogoIcon /> };
  if (lower.endsWith(".ts") || lower.endsWith(".d.ts")) return { tone: "ts", label: "TS" };
  if (
    lower === "styles.css" ||
    lower.endsWith(".css") ||
    lower.endsWith(".scss") ||
    lower.endsWith(".sass")
  )
    return { tone: "css", label: "CSS" };
  if (lower === "package.json" || lower.endsWith(".json"))
    return { tone: "json", icon: <Braces size={16} /> };
  if (lower.endsWith(".md") || lower.endsWith(".mdx"))
    return { tone: "markdown", icon: <MarkdownBadge /> };
  if (lower.endsWith(".html") || lower.endsWith(".htm") || lower.endsWith(".xml"))
    return { tone: "html", icon: <Hash size={16} /> };
  if (lower === "pnpm-lock.yaml" || lower === "pnpm-workspace.yaml")
    return { tone: "pnpm", icon: <PnpmBadge /> };
  if (lower === "bun.lock" || lower === "bun.lockb") return { tone: "bun", icon: <BunBadge /> };
  if (lower === "vite.config.ts" || lower.startsWith("vite.") || lower.includes("vite"))
    return { tone: "vite", icon: <Zap size={16} /> };
  if (lower.endsWith(".lock")) return { tone: "lock", icon: <FileLock2 size={16} /> };
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(lower))
    return { tone: "image", icon: <FileImage size={16} /> };
  if (/\.(zip|tar|gz|tgz|bz2|xz|7z|rar)$/.test(lower))
    return { tone: "archive", icon: <FileArchive size={16} /> };
  if (/\.(sh|bash|zsh|fish|ps1|bat|cmd|psm1)$/.test(lower) || lower === "dockerfile")
    return { tone: "terminal", icon: <FileTerminal size={16} /> };
  if (/\.(yml|yaml|toml|ini|env|conf|config|cfg)$/.test(lower))
    return { tone: "config", icon: <FileCog size={16} /> };
  return { tone: "generic", icon: <FileText size={16} /> };
}

function ReactLogoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="tree-file-badge-react"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="8.4" ry="3.2" />
      <ellipse cx="12" cy="12" rx="8.4" ry="3.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="8.4" ry="3.2" transform="rotate(120 12 12)" />
    </svg>
  );
}

function MarkdownBadge() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="tree-file-badge-markdown"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7.5v9h4.2c1.3 0 2.3-1 2.3-2.3V12" />
      <path d="M10.5 7.5v9" />
      <path d="M13.7 16.5v-9l2.8 3.3 2.8-3.3v9" />
      <path d="M19.5 17.5v-3.2" />
      <path d="M17.9 16.6h3.2" />
    </svg>
  );
}

function BunBadge() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="tree-file-badge-bun"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.8 6.2h8.4c1.9 0 3.5 1.6 3.5 3.5v4.6c0 1.9-1.6 3.5-3.5 3.5H7.8c-1.9 0-3.5-1.6-3.5-3.5V9.7c0-1.9 1.6-3.5 3.5-3.5Z" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M10.7 14.8c.8.5 1.8.5 2.6 0" />
    </svg>
  );
}

function PnpmBadge() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="tree-file-badge-pnpm"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="7" height="7" rx="1.4" />
      <rect x="13" y="4" width="7" height="7" rx="1.4" />
      <rect x="4" y="13" width="7" height="7" rx="1.4" />
      <rect x="13" y="13" width="7" height="7" rx="1.4" />
    </svg>
  );
}

type FileTreeTabProps = {
  tab: RightSidebarTab;
  expandedDirs: string[];
  selectedPath: string | null;
  selectedPathNonce: number;
  onSelectPath: (path: string) => void;
  onToggleExpand: (path: string, open: boolean) => void;
};

export function FileTreeTab({
  tab,
  expandedDirs,
  selectedPath,
  selectedPathNonce,
  onSelectPath,
  onToggleExpand,
}: FileTreeTabProps) {
  const platform = usePlatform();
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
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    platform.listFs({ path: tab.cwd }).then(
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
  }, [platform, tab.cwd]);

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

  const resolvedSelection = useMemo(() => {
    if (!selectedPath) return null;

    const normalizedTarget = normalizeTreePath(selectedPath);
    let best: string | null = null;

    const visit = (node: DirNode) => {
      const normalizedNode = normalizeTreePath(node.path);
      if (normalizedNode === normalizedTarget) {
        best = node.path;
        return;
      }
      if (!isPathPrefix(normalizedNode, normalizedTarget)) return;
      if (!best || normalizeTreePath(node.path).length > normalizeTreePath(best).length) {
        best = node.path;
      }
      node.children?.forEach(visit);
    };

    state.nodes.forEach(visit);
    return best;
  }, [selectedPath, state.nodes]);

  useEffect(() => {
    if (!resolvedSelection) return;
    const ancestorPaths = getPathAncestors(resolvedSelection).slice(0, -1);
    if (ancestorPaths.length === 0) return;
    setState((current) => {
      const expanded = new Set(current.expanded);
      let changed = false;
      for (const ancestorPath of ancestorPaths) {
        if (!expanded.has(ancestorPath)) {
          expanded.add(ancestorPath);
          changed = true;
        }
      }
      return changed ? { ...current, expanded } : current;
    });
  }, [resolvedSelection, selectedPathNonce]);

  useLayoutEffect(() => {
    if (!resolvedSelection || state.loading) return;
    const node = nodeRefs.current.get(resolvedSelection);
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [resolvedSelection, selectedPathNonce, state.loading, state.nodes]);

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

  const handleSelectPath = useCallback(
    (path: string) => {
      onSelectPath(path);
    },
    [onSelectPath],
  );

  return (
    <div className="tree-pane" ref={paneRef}>
      <div className="tree-toolbar">
        <span className="tree-root" title={state.root}>
          {compactPath(state.root) || "/"}
        </span>
        {resolvedSelection && (
          <span className="tree-selection" title={resolvedSelection}>
            {compactPath(resolvedSelection)}
          </span>
        )}
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
              selectedPath={resolvedSelection}
              depth={0}
              onToggle={toggle}
              onSelect={handleSelectPath}
              onContextMenu={openContextMenu}
              registerNodeRef={(path, element) => {
                if (element) nodeRefs.current.set(path, element);
                else nodeRefs.current.delete(path);
              }}
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
              void platform.revealInFinder(menu.path);
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
  selectedPath: string | null;
  depth: number;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (event: ReactMouseEvent, node: DirNode) => void;
  registerNodeRef: (path: string, element: HTMLDivElement | null) => void;
};

function TreeNode({
  node,
  expanded,
  selectedPath,
  depth,
  onToggle,
  onSelect,
  onContextMenu,
  registerNodeRef,
}: TreeNodeProps) {
  const open = expanded.has(node.path);
  const selected = selectedPath ? isSameTreePath(selectedPath, node.path) : false;
  if (node.type === "file") {
    const badge = getTreeFileBadge(node.name);
    return (
      <div
        ref={(element) => registerNodeRef(node.path, element)}
        className={`tree-node tree-file ${selected ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={() => onSelect(node.path)}
        onContextMenu={(event) => onContextMenu(event, node)}
        title={node.path}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(node.path);
          }
        }}
      >
        <span className={`tree-file-badge tree-file-badge-${badge.tone}`} aria-hidden="true">
          {badge.label ? (
            <span className="tree-file-badge-wordmark">{badge.label}</span>
          ) : (
            badge.icon
          )}
        </span>
        <span className="tree-name">{node.name}</span>
      </div>
    );
  }
  return (
    <>
      <div
        ref={(element) => registerNodeRef(node.path, element)}
        className={`tree-node tree-dir ${selected ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={() => onSelect(node.path)}
        onContextMenu={(event) => onContextMenu(event, node)}
        title={node.path}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(node.path);
          }
        }}
      >
        <button
          type="button"
          className="tree-toggle"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.path);
          }}
          aria-expanded={open}
        >
          <ChevronRight size={11} className={`tree-chevron ${open ? "open" : ""}`} />
          <span className="tree-name">{node.name}</span>
        </button>
      </div>
      {open &&
        node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            expanded={expanded}
            selectedPath={selectedPath}
            depth={depth + 1}
            onToggle={onToggle}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            registerNodeRef={registerNodeRef}
          />
        ))}
    </>
  );
}

function normalizeTreePath(value: string) {
  return value.replaceAll("\\", "/").replace(/\/+$/, "") || "/";
}

function isSameTreePath(a: string, b: string) {
  return normalizeTreePath(a) === normalizeTreePath(b);
}

function isPathPrefix(parent: string, child: string) {
  const normalizedParent = normalizeTreePath(parent);
  const normalizedChild = normalizeTreePath(child);
  return (
    normalizedParent === normalizedChild ||
    normalizedChild.startsWith(
      normalizedParent === "/" ? "/" : `${normalizedParent.replace(/\/+$/, "")}/`,
    )
  );
}
