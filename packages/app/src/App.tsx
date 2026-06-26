import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { Composer, type ComposerAttachment } from "./components/Composer";
import { ConversationView } from "./components/ConversationView";
import { LeftSidebar } from "./components/LeftSidebar";
import { RightSidebar } from "./components/RightSidebar";
import { SettingsView } from "./components/SettingsView";
import { disposeTerminalTab } from "./components/TerminalTab";
import { Topbar } from "./components/Topbar";
import type {
  Approval,
  FileChange,
  RightSidebarTab,
  RightSidebarTabKind,
  RuntimeStatus,
  StoredRightSidebarTab,
  StoredState,
} from "./domain/types";
import { useCodexEvents } from "./hooks/useCodexEvents";
import { usePanelResize } from "./hooks/usePanelResize";
import { usePlatform } from "./platform/PlatformContext";
import type { UserInput, WorkspaceChange } from "@icode/platform";
import { buildSession, loadStoredState, persistState } from "./state/persistence";

function createAttachmentId() {
  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("无法读取剪贴板图片"));
    reader.readAsDataURL(file);
  });
}

function clipboardImageFiles(event: ClipboardEvent<HTMLTextAreaElement>) {
  const files = Array.from(event.clipboardData.files).filter((file) =>
    file.type.startsWith("image/"),
  );
  if (files.length > 0) return files;

  return Array.from(event.clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file && file.type.startsWith("image/"));
}

function parseWorkspaceStatus(output: string): WorkspaceChange[] {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .flatMap((line) => {
      if (line.length < 3) return [];
      const code = line.slice(0, 2);
      const rawPath = line.slice(3);
      const pathParts = rawPath.split(" -> ");
      const path = pathParts[pathParts.length - 1] ?? "";
      const kind = code.includes("D")
        ? "delete"
        : code.includes("A") || code === "??"
          ? "add"
          : "modify";
      return [
        {
          path,
          kind,
          diff: "",
          status: "completed" as const,
        } satisfies WorkspaceChange,
      ];
    });
}

async function readWorkspaceChangesViaPty(
  platform: Pick<
    import("@icode/platform").ICodePlatformApi,
    "ptySpawn" | "ptyWrite" | "ptyKill" | "onPtyData" | "onPtyExit"
  >,
  cwd: string | undefined,
) {
  const { id } = await platform.ptySpawn({ cwd: cwd || undefined, cols: 80, rows: 24 });
  let output = "";

  return await new Promise<WorkspaceChange[]>((resolve) => {
    let settled = false;
    const finish = (changes: WorkspaceChange[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribeData();
      unsubscribeExit();
      void platform.ptyKill({ id }).catch(() => {});
      resolve(changes);
    };

    const unsubscribeData = platform.onPtyData(({ id: incomingId, data }) => {
      if (incomingId !== id) return;
      output += data;
    });
    const unsubscribeExit = platform.onPtyExit(({ id: incomingId }) => {
      if (incomingId !== id) return;
      finish(parseWorkspaceStatus(output));
    });
    const timeout = window.setTimeout(() => finish(parseWorkspaceStatus(output)), 4000);

    void platform
      .ptyWrite({
        id,
        data: "git status --porcelain=v1 --untracked-files=all\nexit\n",
      })
      .catch(() => finish([]));
  });
}

export function App() {
  const platform = usePlatform();
  const [appState, setAppState] = useState<StoredState>(() => loadStoredState());
  const [viewMode, setViewMode] = useState<"workspace" | "settings">("workspace");
  const [runtime, setRuntime] = useState<RuntimeStatus>({
    state: "starting",
    version: null,
    error: null,
    launchId: null,
  });
  const [composer, setComposer] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
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
  const [workspaceChanges, setWorkspaceChanges] = useState<WorkspaceChange[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    void platform
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        setAppState((current) =>
          current.selectedModel === settings.defaultModel
            ? current
            : { ...current, selectedModel: settings.defaultModel },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [platform]);

  const currentSession =
    appState.sessions.find((session) => session.id === appState.activeSessionId) ??
    appState.sessions[0];
  const messages = currentSession?.conversation.messages ?? [];
  const activities = currentSession?.conversation.activities ?? [];
  const approvals = currentSession?.conversation.approvals ?? [];
  const sessionFileChanges = currentSession?.conversation.fileChanges ?? [];
  const fileChanges = useMemo(() => {
    const byPath = new Map<string, FileChange>();
    for (const change of workspaceChanges) {
      if (!change.path) continue;
      byPath.set(change.path, {
        ...change,
        id: `workspace:${change.path}`,
      });
    }
    for (const change of sessionFileChanges) {
      if (!change.path) continue;
      byPath.set(change.path, change);
    }
    return [...byPath.values()];
  }, [sessionFileChanges, workspaceChanges]);
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
    let cancelled = false;
    const refreshWorkspaceChanges = async () => {
      if (!platform.capabilities.localWorkspace) {
        setWorkspaceChanges([]);
        return;
      }
      try {
        if (platform.capabilities.workspaceChanges) {
          const changes = await platform.getWorkspaceChanges();
          if (!cancelled) setWorkspaceChanges(changes);
          return;
        }
        const changes = await readWorkspaceChangesViaPty(platform, workspacePath);
        if (!cancelled) setWorkspaceChanges(changes);
      } catch {
        if (!cancelled) setWorkspaceChanges([]);
      }
    };
    void refreshWorkspaceChanges();
    const interval = window.setInterval(() => {
      void refreshWorkspaceChanges();
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [platform, workspacePath]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        const persistTabs: StoredRightSidebarTab[] = tabs
          .filter(
            (tab): tab is RightSidebarTab & { kind: StoredRightSidebarTab["kind"] } =>
              tab.kind === "files" || tab.kind === "tree" || tab.kind === "terminal",
          )
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
    if (!platform.capabilities.localWorkspace) {
      setError("Web 端工作区选择尚未接入");
      return;
    }
    const directory = await platform.pickDirectory();
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
    setComposerAttachments([]);
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
        setComposerAttachments([]);
      }
      return { ...current, sessions, activeSessionId };
    });
  }

  async function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = clipboardImageFiles(event);
    if (files.length === 0) return;

    event.preventDefault();
    const additions = files.map((file) => ({
      id: createAttachmentId(),
      type: "image" as const,
      name: file.name || `clipboard-${Date.now()}.png`,
      url: "",
      status: "loading" as const,
    }));
    setComposerAttachments((current) => [...current, ...additions]);

    await Promise.all(
      additions.map(async (attachment, index) => {
        try {
          const dataUrl = await fileToDataUrl(files[index]);
          setComposerAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id
                ? { ...item, url: dataUrl, status: "ready" as const }
                : item,
            ),
          );
        } catch {
          setComposerAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id ? { ...item, status: "error" as const } : item,
            ),
          );
        }
      }),
    );
  }

  function removeComposerAttachment(id: string) {
    setComposerAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = composer.trim();
    const readyAttachments = composerAttachments.filter(
      (attachment) => attachment.status === "ready" && attachment.url,
    );
    if (
      (!content && readyAttachments.length === 0) ||
      sendingRef.current ||
      runtime.state !== "ready"
    )
      return;
    if (composerAttachments.some((attachment) => attachment.status === "loading")) return;
    if (currentSessionActiveTurn) return;
    const sessionId = appState.activeSessionId;
    const userMessageId = `user-${Date.now()}`;
    const pendingAttachments = readyAttachments.map((attachment) => ({ ...attachment }));
    sendingRef.current = true;
    setComposer("");
    setComposerAttachments([]);
    setError(null);

    const input: UserInput[] = [
      ...(content ? [{ type: "text" as const, text: content }] : []),
      ...readyAttachments.map((attachment) => ({
        type: "image" as const,
        url: attachment.url,
      })),
    ];

    setAppState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title:
                session.title === "新任务"
                  ? (content || `${readyAttachments.length} 张图片`).slice(0, 24)
                  : session.title,
              detail: (content || `${readyAttachments.length} 张图片`).slice(0, 36),
              time: "刚刚",
              conversation: {
                ...session.conversation,
                messages: [
                  ...session.conversation.messages,
                  {
                    id: userMessageId,
                    role: "user",
                    content: content || (readyAttachments.length > 0 ? "已发送图片" : ""),
                    attachments: readyAttachments.map((attachment) => ({
                      type: "image",
                      url: attachment.url,
                      name: attachment.name,
                    })),
                  },
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
        const result = await platform.startThread({ model: selectedModel });
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
      const result = await platform.sendTurn({
        threadId,
        input,
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
      setComposerAttachments((current) => (current.length === 0 ? pendingAttachments : current));
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
    await platform.respondToCodex({ id: approval.id, result: { decision } });
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
    await platform.interruptTurn(activeTurn);
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
  const handleDefaultModelChange = useCallback((model: typeof selectedModel) => {
    setAppState((current) =>
      current.selectedModel === model ? current : { ...current, selectedModel: model },
    );
  }, []);

  if (viewMode === "settings") {
    return (
      <SettingsView
        onClose={() => setViewMode("workspace")}
        onDefaultModelChange={handleDefaultModelChange}
      />
    );
  }

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
        onOpenSettings={() => setViewMode("settings")}
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
          attachments={composerAttachments}
          selectedModel={selectedModel}
          runtime={runtime}
          runtimeLabel={runtimeLabel}
          active={!!currentSessionActiveTurn}
          onChange={setComposer}
          onPaste={handleComposerPaste}
          onSubmit={sendMessage}
          onSelectModel={(model) =>
            setAppState((current) => ({ ...current, selectedModel: model }))
          }
          onInterrupt={() => void interrupt()}
          onRemoveAttachment={removeComposerAttachment}
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
      disposeTerminalTab(id, platform);
    }
    setTabs((current) => current.filter((t) => t.id !== id));
    setActiveTabId((current) => {
      if (current !== id) return current;
      const remaining = tabsRef.current.filter((t) => t.id !== id);
      return remaining[Math.max(0, remaining.length - 1)]?.id ?? "files";
    });
  }
}
