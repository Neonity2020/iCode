import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Composer } from "./components/Composer";
import { ConversationView } from "./components/ConversationView";
import { LeftSidebar } from "./components/LeftSidebar";
import { RightSidebar } from "./components/RightSidebar";
import { disposeTerminalTab } from "./components/TerminalTab";
import { Topbar } from "./components/Topbar";
import type {
  Approval,
  RightSidebarTab,
  RightSidebarTabKind,
  RuntimeStatus,
  StoredRightSidebarTab,
  StoredState,
} from "./domain/types";
import { useCodexEvents } from "./hooks/useCodexEvents";
import { usePanelResize } from "./hooks/usePanelResize";
import { buildSession, loadStoredState, persistState } from "./state/persistence";

export function App() {
  const [appState, setAppState] = useState<StoredState>(() => loadStoredState());
  const [runtime, setRuntime] = useState<RuntimeStatus>({
    state: "starting",
    version: null,
    error: null,
    launchId: null,
  });
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [tabs, setTabs] = useState<RightSidebarTab[]>(() => appState.tabs.map((t) => ({ ...t })));
  const [activeTabId, setActiveTabId] = useState<string>(appState.activeTabId);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<string, boolean>>({});
  const [expandedActivityBundles, setExpandedActivityBundles] = useState<Record<number, boolean>>(
    {},
  );
  // Persisted expanded directories across all file-tree tabs. A single global
  // set is fine: entries are absolute paths, and restoring a tab simply reopens
  // whichever of these paths still exist beneath its root.
  const [expandedDirs, setExpandedDirs] = useState<string[]>(appState.expandedDirs);
  const conversationRef = useRef<HTMLElement>(null);
  const { sendingRef, runningTurnRef, threadSessionMapRef } = useCodexEvents({
    appState,
    setAppState,
    setRuntime,
  });

  const currentSession =
    appState.sessions.find((session) => session.id === appState.activeSessionId) ??
    appState.sessions[0];
  const messages = currentSession?.conversation.messages ?? [];
  const activities = currentSession?.conversation.activities ?? [];
  const approvals = currentSession?.conversation.approvals ?? [];
  const fileChanges = currentSession?.conversation.fileChanges ?? [];
  const activeTurnSession = appState.sessions.find((session) => session.conversation.activeTurn);
  const activeTurn = activeTurnSession?.conversation.activeTurn ?? null;
  const currentSessionActiveTurn = currentSession?.conversation.activeTurn ?? null;
  const rightSidebarOpen = appState.rightSidebarOpen;
  const completedFileChangeCount = fileChanges.filter((f) => f.status === "completed").length;
  const workspacePath = appState.workspacePath;
  const sidebarOpen = appState.sidebarOpen;
  const activeTitle = currentSession?.title ?? "新任务";
  const selectedModel = appState.selectedModel;
  const activityBundleExpanded =
    expandedActivityBundles[currentSession?.id ?? -1] ?? activities.length <= 2;
  const handleWidthsChange = useCallback((leftWidth: number, rightWidth: number) => {
    setAppState((current) =>
      current.sidebarWidth === leftWidth && current.rightSidebarWidth === rightWidth
        ? current
        : { ...current, sidebarWidth: leftWidth, rightSidebarWidth: rightWidth },
    );
  }, []);
  const {
    shellRef,
    leftWidth: sidebarWidth,
    rightWidth: rightSidebarWidth,
    startResize: startPanelResize,
  } = usePanelResize({
    initialLeftWidth: appState.sidebarWidth,
    initialRightWidth: appState.rightSidebarWidth,
    leftOpen: sidebarOpen,
    rightOpen: rightSidebarOpen,
    onWidthsChange: handleWidthsChange,
  });

  useEffect(() => {
    const element = conversationRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, activities, approvals, error]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        const persistTabs: StoredRightSidebarTab[] = tabs
          .filter((t) => t.kind !== "terminal")
          .map((t) => ({ id: t.id, kind: t.kind, title: t.title, cwd: t.cwd }));
        persistState({
          ...appState,
          appRunId: runtime.launchId ?? appState.appRunId,
          sidebarWidth,
          rightSidebarWidth,
          tabs: persistTabs,
          activeTabId,
          expandedDirs,
        });
      } catch {
        // Ignore storage failures; the UI still works in memory.
      }
    }, 120);

    return () => window.clearTimeout(handle);
  }, [
    appState,
    runtime.launchId,
    tabs,
    activeTabId,
    expandedDirs,
    sidebarWidth,
    rightSidebarWidth,
  ]);

  useEffect(() => {
    setExpandedActivityIds({});
  }, [currentSession?.id]);

  const handleToggleExpand = useCallback((path: string, open: boolean) => {
    setExpandedDirs((current) => {
      const set = new Set(current);
      if (open) set.add(path);
      else set.delete(path);
      return [...set];
    });
  }, []);

  async function chooseWorkspace() {
    const directory = await window.icode?.pickDirectory();
    if (!directory) return;
    setAppState((current) => ({
      ...current,
      workspacePath: directory,
    }));
    createNewSession();
  }

  function createNewSession() {
    const id = Date.now();
    setAppState((current) => ({
      ...current,
      activeSessionId: id,
      sessions: [
        buildSession({ id, title: "新任务", detail: "描述你想完成的工作", time: "刚刚" }),
        ...current.sessions,
      ],
    }));
    setComposer("");
  }

  function deleteSession(sessionId: number) {
    setAppState((current) => {
      const remaining = current.sessions.filter((session) => session.id !== sessionId);
      const fallback = buildSession();
      const sessions = remaining.length > 0 ? remaining : [fallback];
      const activeSessionId =
        sessions.find((session) => session.id === current.activeSessionId)?.id ?? sessions[0].id;
      if (activeSessionId === sessions[0].id && current.activeSessionId !== activeSessionId) {
        setComposer("");
      }
      return { ...current, sessions, activeSessionId };
    });
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = composer.trim();
    if (!content || sendingRef.current || runtime.state !== "ready") return;
    if (currentSessionActiveTurn) return;
    const sessionId = appState.activeSessionId;
    const userMessageId = `user-${Date.now()}`;
    sendingRef.current = true;
    setComposer("");
    setError(null);

    setAppState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新任务" ? content.slice(0, 24) : session.title,
              detail: content.slice(0, 36),
              time: "刚刚",
              conversation: {
                ...session.conversation,
                messages: [
                  ...session.conversation.messages,
                  { id: userMessageId, role: "user", content },
                ],
                error: null,
              },
            }
          : session,
      ),
    }));

    try {
      let threadId = currentSession?.threadId;
      if (!threadId) {
        const result = await window.icode?.startThread({ model: selectedModel });
        threadId = result?.thread.id;
        if (!threadId) throw new Error("Codex 未返回 thread id");
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId ? { ...session, threadId } : session,
          ),
        }));
        threadSessionMapRef.current.set(threadId, sessionId);
      }
      const result = await window.icode?.sendTurn({
        threadId,
        text: content,
        model: selectedModel,
      });
      if (result?.turn.id) {
        runningTurnRef.current = { sessionId, threadId, turnId: result.turn.id };
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    activeTurn: { threadId, turnId: result.turn.id },
                  },
                }
              : session,
          ),
        }));
      }
    } catch (caught) {
      sendingRef.current = false;
      runningTurnRef.current = null;
      const message = caught instanceof Error ? caught.message : String(caught);
      setAppState((current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                conversation: {
                  ...session.conversation,
                  messages: session.conversation.messages.filter((msg) => msg.id !== userMessageId),
                  activeTurn: null,
                  error: message,
                },
              }
            : session,
        ),
      }));
    }
  }

  async function answerApproval(approval: Approval, decision: "accept" | "decline") {
    await window.icode?.respondToCodex({ id: approval.id, result: { decision } });
    const sessionId = runningTurnRef.current?.sessionId ?? appState.activeSessionId;
    setAppState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              conversation: {
                ...session.conversation,
                approvals: session.conversation.approvals.filter((item) => item.id !== approval.id),
              },
            }
          : session,
      ),
    }));
  }

  async function interrupt() {
    if (!activeTurn) return;
    await window.icode?.interruptTurn(activeTurn);
    sendingRef.current = false;
    runningTurnRef.current = null;
    setAppState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === activeTurnSession?.id
          ? {
              ...session,
              conversation: {
                ...session.conversation,
                activeTurn: null,
              },
            }
          : session,
      ),
    }));
  }

  const runtimeLabel = useMemo(() => {
    if (runtime.state === "ready") return "Codex 已连接";
    if (runtime.state === "error") return "Codex 连接失败";
    return "正在连接 Codex";
  }, [runtime.state]);

  return (
    <div
      ref={shellRef}
      className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${
        rightSidebarOpen ? "" : "right-collapsed"
      }`}
      style={
        {
          "--left-sidebar-width": `${sidebarOpen ? sidebarWidth : 0}px`,
          "--left-resizer-width": `${sidebarOpen ? 6 : 0}px`,
          "--right-resizer-width": `${rightSidebarOpen ? 6 : 0}px`,
          "--right-sidebar-width": `${rightSidebarOpen ? rightSidebarWidth : 0}px`,
        } as CSSProperties
      }
    >
      <LeftSidebar
        sessions={appState.sessions}
        activeSessionId={appState.activeSessionId}
        workspacePath={workspacePath}
        runtime={runtime}
        runtimeLabel={runtimeLabel}
        onChooseWorkspace={() => void chooseWorkspace()}
        onCollapse={() => setAppState((current) => ({ ...current, sidebarOpen: false }))}
        onCreateSession={createNewSession}
        onSelectSession={(id) => setAppState((current) => ({ ...current, activeSessionId: id }))}
        onDeleteSession={deleteSession}
      />

      <main className="main-panel">
        <Topbar
          sidebarOpen={sidebarOpen}
          rightSidebarOpen={rightSidebarOpen}
          title={activeTitle}
          workspacePath={workspacePath}
          runtimeLabel={runtimeLabel}
          completedFileChangeCount={completedFileChangeCount}
          onOpenSidebar={() => setAppState((current) => ({ ...current, sidebarOpen: true }))}
          onChooseWorkspace={() => void chooseWorkspace()}
          onToggleRightSidebar={() =>
            setAppState((current) => ({
              ...current,
              rightSidebarOpen: !current.rightSidebarOpen,
            }))
          }
        />

        <ConversationView
          containerRef={conversationRef}
          messages={messages}
          activities={activities}
          approvals={approvals}
          error={currentSession?.conversation.error ?? error ?? runtime.error}
          activityBundleExpanded={activityBundleExpanded}
          expandedActivityIds={expandedActivityIds}
          onToggleActivityBundle={() =>
            setExpandedActivityBundles((current) => ({
              ...current,
              [currentSession?.id ?? -1]: !activityBundleExpanded,
            }))
          }
          onToggleActivity={(id, expanded) =>
            setExpandedActivityIds((current) => ({ ...current, [id]: expanded }))
          }
          onApprovalDecision={(approval, decision) => void answerApproval(approval, decision)}
        />

        <Composer
          value={composer}
          selectedModel={selectedModel}
          runtime={runtime}
          runtimeLabel={runtimeLabel}
          active={!!currentSessionActiveTurn}
          onChange={setComposer}
          onSubmit={sendMessage}
          onSelectModel={(model) =>
            setAppState((current) => ({ ...current, selectedModel: model }))
          }
          onInterrupt={() => void interrupt()}
        />
      </main>

      <div
        className="panel-resizer left"
        aria-hidden="true"
        onPointerDown={(event) => startPanelResize("left", event)}
      />

      {rightSidebarOpen && (
        <>
          <div
            className="panel-resizer right"
            aria-hidden="true"
            onPointerDown={(event) => startPanelResize("right", event)}
          />
          <RightSidebar
            tabs={tabs}
            activeTabId={activeTabId}
            fileChanges={fileChanges}
            expandedFiles={expandedFiles}
            expandedDirs={expandedDirs}
            onSelectTab={setActiveTabId}
            onAddTab={addTab}
            onCloseTab={closeTab}
            onToggleFile={(id) =>
              setExpandedFiles((current) => ({ ...current, [id]: !current[id] }))
            }
            onToggleDirectory={handleToggleExpand}
          />
        </>
      )}
    </div>
  );

  function addTab(kind: RightSidebarTabKind) {
    const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const title = kind === "files" ? "文件变更" : kind === "terminal" ? "终端" : "文件树";
    setTabs((current) => [...current, { id, kind, title, cwd: workspacePath || undefined }]);
    setActiveTabId(id);
  }

  function closeTab(id: string) {
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!tab || tab.kind === "files") return;
    if (tab.kind === "terminal") {
      disposeTerminalTab(id);
    }
    setTabs((current) => current.filter((t) => t.id !== id));
    setActiveTabId((current) => {
      if (current !== id) return current;
      const remaining = tabsRef.current.filter((t) => t.id !== id);
      return remaining[Math.max(0, remaining.length - 1)]?.id ?? "files";
    });
  }
}
