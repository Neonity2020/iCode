import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  File,
  FileCode2,
  Folder,
  GitBranch,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";

type Session = { id: number; title: string; detail: string; time: string };
type Message = { id: number; role: "user" | "assistant"; content: string };
type FileNode = { id: string; name: string; kind: "folder" | "file"; depth: number };
type WorkspaceTab = {
  id: number;
  sessionId: number;
  title: string;
  detail: string;
  messages: Message[];
  composer: string;
  files: FileNode[];
  terminalLines: string[];
};

const initialSessions: Session[] = [
  { id: 1, title: "设计轻量桌面架构", detail: "梳理项目边界与首版功能", time: "刚刚" },
  { id: 2, title: "修复设置页面", detail: "检查窗口主题切换", time: "昨天" },
  { id: 3, title: "整理发布脚本", detail: "简化 Electron 打包流程", time: "周一" },
];

const initialMessages: Message[] = [
  { id: 1, role: "user", content: "分析当前项目，然后给出一个更轻量的桌面实现方案。" },
  {
    id: 2,
    role: "assistant",
    content:
      "我会把运行链路压缩到 Electron、OpenCode 和 React 三层。首版只保留工作区、会话、流式消息、工具确认和文件结果，避免复制远程服务与云端能力。",
  },
];

const starterFiles: FileNode[] = [
  { id: "src", name: "src", kind: "folder", depth: 0 },
  { id: "src-app", name: "App.tsx", kind: "file", depth: 1 },
  { id: "src-styles", name: "styles.css", kind: "file", depth: 1 },
  { id: "electron", name: "electron", kind: "folder", depth: 0 },
  { id: "electron-main", name: "main.mjs", kind: "file", depth: 1 },
  { id: "electron-preload", name: "preload.cjs", kind: "file", depth: 1 },
  { id: "package", name: "package.json", kind: "file", depth: 0 },
];

const emptyFiles: FileNode[] = [
  { id: "workspace", name: "workspace", kind: "folder", depth: 0 },
  { id: "workspace-readme", name: "README.md", kind: "file", depth: 1 },
];

const initialTabs: WorkspaceTab[] = [
  {
    id: 101,
    sessionId: 1,
    title: "设计轻量桌面架构",
    detail: "梳理项目边界与首版功能",
    messages: initialMessages,
    composer: "",
    files: starterFiles,
    terminalLines: ["icode@local % pnpm dev", "Vite dev server ready", "Electron window connected"],
  },
];

function compactPath(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

function createTab(session: Session, messages: Message[] = []): WorkspaceTab {
  return {
    id: session.id,
    sessionId: session.id,
    title: session.title,
    detail: session.detail,
    messages,
    composer: "",
    files: messages.length > 0 ? starterFiles : emptyFiles,
    terminalLines:
      messages.length > 0 ? ["icode@local % pnpm dev", "workspace restored"] : ["icode@local %"],
  };
}

export function App() {
  const [sessions, setSessions] = useState(initialSessions);
  const [tabs, setTabs] = useState(initialTabs);
  const [activeTabId, setActiveTabId] = useState(initialTabs[0].id);
  const [workspace, setWorkspace] = useState("icode");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId), [activeTabId, tabs]);

  if (!activeTab) return null;
  const currentTab = activeTab;

  async function chooseWorkspace() {
    const directory = await window.icode?.pickDirectory();
    if (directory) setWorkspace(compactPath(directory));
  }

  function createSession() {
    const id = Date.now();
    const session = { id, title: "新任务", detail: "描述你想完成的工作", time: "刚刚" };
    setSessions((current) => [session, ...current]);
    setTabs((current) => [...current, createTab(session)]);
    setActiveTabId(id);
  }

  function openSession(session: Session) {
    const existingTab = tabs.find((tab) => tab.sessionId === session.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const messages = session.id === 1 ? initialMessages : [];
    const tab = createTab(session, messages);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
  }

  function closeTab(tabId: number) {
    if (tabs.length === 1) return;

    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId !== tabId) return;

    const closedIndex = tabs.findIndex((tab) => tab.id === tabId);
    const nextIndex = Math.max(0, closedIndex - 1);
    const nextTab = nextTabs[nextIndex] ?? nextTabs[0];
    if (nextTab) setActiveTabId(nextTab.id);
  }

  function updateActiveTab(update: (tab: WorkspaceTab) => WorkspaceTab) {
    setTabs((current) => current.map((tab) => (tab.id === currentTab.id ? update(tab) : tab)));
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = currentTab.composer.trim();
    if (!content) return;

    const tabId = currentTab.id;
    const userMessage: Message = { id: Date.now(), role: "user", content };
    updateActiveTab((tab) => ({
      ...tab,
      composer: "",
      messages: [...tab.messages, userMessage],
      terminalLines: [...tab.terminalLines, `icode@local % ${content.slice(0, 42)}`],
    }));
    window.setTimeout(() => {
      setTabs((current) =>
        current.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                messages: [
                  ...tab.messages,
                  {
                    id: Date.now() + 1,
                    role: "assistant",
                    content:
                      "桌面骨架已就绪。下一步将从这里连接 OpenCode SDK，并把真实的流式事件映射到消息和工具状态。",
                  },
                ],
                terminalLines: [...tab.terminalLines, "agent: ready for next step"],
              }
            : tab,
        ),
      );
    }, 450);
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="traffic-light-space" />
        <div className="workspace-row">
          <button className="workspace-button" type="button" onClick={chooseWorkspace}>
            <span className="workspace-icon">
              <Code2 size={15} />
            </span>
            <span>{workspace}</span>
            <ChevronDown size={14} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="收起侧栏"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeft size={16} />
          </button>
        </div>

        <button className="new-task" type="button" onClick={createSession}>
          <Plus size={16} />
          <span>新任务</span>
          <kbd>⌘ N</kbd>
        </button>
        <button className="search-button" type="button">
          <Search size={15} />
          <span>搜索任务</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="sidebar-label">最近</div>
        <nav className="session-list" aria-label="最近任务">
          {sessions.map((session) => (
            <button
              className={`session-item ${currentTab.sessionId === session.id ? "active" : ""}`}
              key={session.id}
              type="button"
              onClick={() => openSession(session)}
            >
              <span className="session-copy">
                <strong>{session.title}</strong>
                <small>{session.detail}</small>
              </span>
              <span className="session-time">{session.time}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button">
            <Settings size={16} />
            <span>设置</span>
          </button>
          <div className="runtime-status">
            <span /> 本地运行
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          {!sidebarOpen && (
            <button
              className="icon-button"
              type="button"
              aria-label="展开侧栏"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft size={17} />
            </button>
          )}
          <div className="title-block">
            <strong>{currentTab.title}</strong>
            <span>
              <GitBranch size={13} /> main
            </span>
          </div>
          <div className="topbar-actions">
            <button className="status-pill" type="button">
              <Check size={13} /> 工作区已连接
            </button>
            <button className="icon-button" type="button" aria-label="更多操作">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <div className="tabbar" role="tablist" aria-label="打开的任务">
          <div className="tab-list">
            {tabs.map((tab) => (
              <div className={`tab-item ${currentTab.id === tab.id ? "active" : ""}`} key={tab.id}>
                <button
                  className="tab-select"
                  type="button"
                  role="tab"
                  aria-selected={currentTab.id === tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span className="tab-title">{tab.title}</span>
                  <span className="tab-meta">
                    {tab.messages.length > 0 ? `${tab.messages.length} 条` : "空白"}
                  </span>
                </button>
                {tabs.length > 1 && (
                  <button
                    className="tab-close"
                    type="button"
                    aria-label={`关闭 ${tab.title}`}
                    onClick={() => closeTab(tab.id)}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="tab-add" type="button" aria-label="新建标签" onClick={createSession}>
            <Plus size={15} />
          </button>
        </div>

        <section className="workspace-split">
          <div className="work-column">
            <section className="conversation">
              <div className="message-column">
                {currentTab.messages.length === 0 ? (
                  <div className="empty-state">
                    <span>
                      <Sparkles size={21} />
                    </span>
                    <h1>从一个任务开始</h1>
                    <p>描述要构建、修改或调查的内容。</p>
                  </div>
                ) : (
                  currentTab.messages.map((message) => (
                    <article className={`message ${message.role}`} key={message.id}>
                      {message.role === "assistant" && (
                        <div className="assistant-mark">
                          <Sparkles size={14} />
                        </div>
                      )}
                      <div className="message-content">{message.content}</div>
                    </article>
                  ))
                )}

                {currentTab.messages.length > 0 && (
                  <div className="activity-card">
                    <div className="activity-icon">
                      <FileCode2 size={16} />
                    </div>
                    <div>
                      <strong>项目结构</strong>
                      <span>已读取 Electron 与 React 入口</span>
                    </div>
                    <Check size={16} className="activity-check" />
                  </div>
                )}
              </div>
            </section>

            <div className="composer-wrap">
              <form className="composer" onSubmit={sendMessage}>
                <textarea
                  aria-label="任务描述"
                  placeholder="描述一个任务，或输入 / 使用命令"
                  value={currentTab.composer}
                  onChange={(event) =>
                    updateActiveTab((tab) => ({ ...tab, composer: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <div className="composer-toolbar">
                  <div>
                    <button className="tool-button" type="button">
                      <Paperclip size={16} />
                    </button>
                    <button className="model-button" type="button">
                      Auto <ChevronDown size={13} />
                    </button>
                  </div>
                  <div className="composer-context">
                    本地上下文 <span>·</span> 0%
                  </div>
                  <button
                    className="send-button"
                    type="submit"
                    disabled={!currentTab.composer.trim()}
                    aria-label="发送"
                  >
                    <ArrowUp size={17} />
                  </button>
                </div>
              </form>
              <p className="composer-hint">iCode 可能会出错，请在应用修改前检查重要内容。</p>
            </div>
          </div>

          <aside className="right-rail" aria-label="任务上下文">
            <section className="rail-card file-tree">
              <div className="rail-header">
                <div>
                  <strong>文件树</strong>
                  <span>{workspace}</span>
                </div>
                <button className="mini-button" type="button">
                  <Plus size={13} />
                </button>
              </div>
              <div className="file-list">
                {currentTab.files.map((file) => (
                  <button
                    className={`file-row depth-${file.depth}`}
                    key={file.id}
                    type="button"
                    title={file.name}
                  >
                    {file.kind === "folder" ? <Folder size={14} /> : <File size={14} />}
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rail-card terminal-card">
              <div className="rail-header">
                <div>
                  <strong>终端</strong>
                  <span>local shell</span>
                </div>
                <Terminal size={14} />
              </div>
              <div className="terminal-window">
                {currentTab.terminalLines.map((line, index) => (
                  <div className="terminal-line" key={`${index}-${line}`}>
                    {line}
                  </div>
                ))}
                <div className="terminal-cursor">▌</div>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
