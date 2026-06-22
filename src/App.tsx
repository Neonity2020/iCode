import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  FileCode2,
  GitBranch,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

type Session = { id: number; title: string; detail: string; time: string };
type Message = { id: number; role: "user" | "assistant"; content: string };

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

function compactPath(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

export function App() {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState(1);
  const [messages, setMessages] = useState(initialMessages);
  const [composer, setComposer] = useState("");
  const [workspace, setWorkspace] = useState("icode");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeTitle = useMemo(
    () => sessions.find((session) => session.id === activeSession)?.title ?? "新任务",
    [activeSession, sessions],
  );

  async function chooseWorkspace() {
    const directory = await window.icode?.pickDirectory();
    if (directory) setWorkspace(compactPath(directory));
  }

  function createSession() {
    const id = Date.now();
    setSessions((current) => [
      { id, title: "新任务", detail: "描述你想完成的工作", time: "刚刚" },
      ...current,
    ]);
    setActiveSession(id);
    setMessages([]);
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = composer.trim();
    if (!content) return;

    setMessages((current) => [...current, { id: Date.now(), role: "user", content }]);
    setComposer("");
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "桌面骨架已就绪。下一步将从这里连接 OpenCode SDK，并把真实的流式事件映射到消息和工具状态。",
        },
      ]);
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
              className={`session-item ${activeSession === session.id ? "active" : ""}`}
              key={session.id}
              type="button"
              onClick={() => setActiveSession(session.id)}
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
            <strong>{activeTitle}</strong>
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

        <section className="conversation">
          <div className="message-column">
            {messages.length === 0 ? (
              <div className="empty-state">
                <span>
                  <Sparkles size={21} />
                </span>
                <h1>从一个任务开始</h1>
                <p>描述要构建、修改或调查的内容。</p>
              </div>
            ) : (
              messages.map((message) => (
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

            {messages.length > 0 && (
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
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
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
                disabled={!composer.trim()}
                aria-label="发送"
              >
                <ArrowUp size={17} />
              </button>
            </div>
          </form>
          <p className="composer-hint">iCode 可能会出错，请在应用修改前检查重要内容。</p>
        </div>
      </main>
    </div>
  );
}
