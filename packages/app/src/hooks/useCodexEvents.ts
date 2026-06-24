import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  Approval,
  CodexItem,
  FileChange,
  FileChangeKind,
  RuntimeStatus,
  StoredState,
} from "../domain/types";
import { describeItem } from "../lib/codex";
import { usePlatform } from "../platform/PlatformContext";
import { resetSessionForNewLaunch } from "../state/persistence";

export type RunningTurn = {
  sessionId: number;
  threadId: string;
  turnId: string;
};

type UseCodexEventsOptions = {
  appState: StoredState;
  setAppState: Dispatch<SetStateAction<StoredState>>;
  setRuntime: Dispatch<SetStateAction<RuntimeStatus>>;
};

export function useCodexEvents({ appState, setAppState, setRuntime }: UseCodexEventsOptions) {
  const platform = usePlatform();
  const sendingRef = useRef(false);
  const runningTurnRef = useRef<RunningTurn | null>(null);
  const appStateRef = useRef(appState);
  const threadSessionMapRef = useRef(new Map<string, number>());
  const recentEventsRef = useRef(new Map<string, number>());

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    const map = new Map<string, number>();
    for (const session of appState.sessions) {
      if (session.threadId) map.set(session.threadId, session.id);
    }
    threadSessionMapRef.current = map;
  }, [appState.sessions]);

  useEffect(() => {
    void platform.getState().then((state) => {
      setAppState((current) => ({ ...current, workspacePath: state.workspace }));
      setRuntime({ ...state.codex, launchId: state.launchId });
      setAppState((current) => {
        if (current.appRunId === state.launchId) return current;
        return {
          ...current,
          appRunId: state.launchId,
          sessions: current.sessions.map(resetSessionForNewLaunch),
        };
      });
    });

    return platform.onCodexEvent((event) => {
      const eventKey = JSON.stringify(event);
      const now = performance.now();
      const previousSeenAt = recentEventsRef.current.get(eventKey);
      if (previousSeenAt && now - previousSeenAt < 50) return;
      recentEventsRef.current.set(eventKey, now);
      for (const [key, seenAt] of recentEventsRef.current) {
        if (now - seenAt > 1_000) recentEventsRef.current.delete(key);
      }

      const getTargetSessionId = (threadId?: string) => {
        if (threadId && threadSessionMapRef.current.has(threadId)) {
          return threadSessionMapRef.current.get(threadId) ?? appStateRef.current.activeSessionId;
        }
        return runningTurnRef.current?.sessionId ?? appStateRef.current.activeSessionId;
      };

      if (event.type === "status") {
        setRuntime((current) => ({ ...event.status, launchId: current.launchId }));
        return;
      }

      if (event.type === "request") {
        const threadId =
          event.request.params &&
          typeof event.request.params === "object" &&
          typeof (event.request.params as Record<string, unknown>).threadId === "string"
            ? String((event.request.params as Record<string, unknown>).threadId)
            : undefined;
        const sessionId = getTargetSessionId(threadId);
        const request = {
          ...event.request,
          params:
            event.request.params && typeof event.request.params === "object"
              ? (event.request.params as Record<string, unknown>)
              : {},
        } as Approval;
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    approvals: [...session.conversation.approvals, request],
                  },
                }
              : session,
          ),
        }));
        return;
      }

      if (event.type !== "notification") return;
      const params = event.params ?? {};

      if (event.method === "turn/started") {
        const turn = params.turn as { id?: string } | undefined;
        if (typeof params.threadId !== "string" || !turn?.id) return;
        const threadId = String(params.threadId);
        const sessionId = getTargetSessionId(threadId);
        runningTurnRef.current = { sessionId, threadId, turnId: String(turn.id) };
        threadSessionMapRef.current.set(threadId, sessionId);
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  threadId,
                  conversation: {
                    ...session.conversation,
                    activeTurn: { threadId, turnId: String(turn.id) },
                    error: null,
                  },
                }
              : session,
          ),
        }));
        return;
      }

      if (event.method === "turn/completed") {
        const sessionId =
          runningTurnRef.current?.sessionId ??
          (typeof params.threadId === "string"
            ? getTargetSessionId(String(params.threadId))
            : null);
        if (sessionId) {
          setAppState((current) => ({
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    conversation: { ...session.conversation, activeTurn: null },
                  }
                : session,
            ),
          }));
        }
        sendingRef.current = false;
        runningTurnRef.current = null;
        return;
      }

      const sessionId = runningTurnRef.current?.sessionId ?? getTargetSessionId();

      if (event.method === "item/agentMessage/delta") {
        const itemId = String(params.itemId);
        const delta = String(params.delta ?? "");
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            const found = session.conversation.messages.findIndex(
              (message) => message.id === itemId,
            );
            const messages =
              found < 0
                ? [
                    ...session.conversation.messages,
                    { id: itemId, role: "assistant" as const, content: delta },
                  ]
                : session.conversation.messages.map((message, index) =>
                    index === found ? { ...message, content: message.content + delta } : message,
                  );
            return { ...session, conversation: { ...session.conversation, messages } };
          }),
        }));
        return;
      }

      if (event.method === "item/started" || event.method === "item/completed") {
        const item = params.item as CodexItem | undefined;
        if (!item?.id || item.type === "userMessage") return;

        if (item.type === "agentMessage") {
          const text = String(item.text ?? "");
          setAppState((current) => ({
            ...current,
            sessions: current.sessions.map((session) => {
              if (session.id !== sessionId) return session;
              const exists = session.conversation.messages.some(
                (message) => message.id === item.id,
              );
              const messages = exists
                ? session.conversation.messages.map((message) =>
                    message.id === item.id ? { ...message, content: text } : message,
                  )
                : [
                    ...session.conversation.messages,
                    { id: String(item.id), role: "assistant" as const, content: text },
                  ];
              return { ...session, conversation: { ...session.conversation, messages } };
            }),
          }));
          return;
        }

        if (item.type === "fileChange") {
          const rawChanges =
            item.changes && typeof item.changes === "object"
              ? (item.changes as Record<string, unknown>)
              : {};
          const kindRaw = typeof rawChanges.kind === "string" ? rawChanges.kind : "modify";
          const kind: FileChangeKind =
            kindRaw === "add" || kindRaw === "delete" ? kindRaw : "modify";
          const statusRaw = String(item.status ?? "completed");
          const status: FileChange["status"] =
            event.method === "item/completed"
              ? statusRaw === "failed"
                ? "failed"
                : "completed"
              : "inProgress";
          const entry: FileChange = {
            id: String(item.id),
            path: typeof rawChanges.path === "string" ? rawChanges.path : "",
            kind,
            diff: typeof rawChanges.diff === "string" ? rawChanges.diff : "",
            status,
          };
          setAppState((current) => ({
            ...current,
            sessions: current.sessions.map((session) => {
              if (session.id !== sessionId) return session;
              const fileChanges = session.conversation.fileChanges.some(
                (change) => change.id === item.id,
              )
                ? session.conversation.fileChanges.map((change) =>
                    change.id === item.id ? entry : change,
                  )
                : [...session.conversation.fileChanges, entry];
              return { ...session, conversation: { ...session.conversation, fileChanges } };
            }),
          }));
          return;
        }

        const copy = describeItem(item);
        const status =
          event.method === "item/completed" ? String(item.status ?? "completed") : "inProgress";
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            const activity = { id: String(item.id), ...copy, status };
            const activities = session.conversation.activities.some((entry) => entry.id === item.id)
              ? session.conversation.activities.map((entry) =>
                  entry.id === item.id ? activity : entry,
                )
              : [...session.conversation.activities, activity];
            return { ...session, conversation: { ...session.conversation, activities } };
          }),
        }));
        return;
      }

      if (event.method === "error") {
        sendingRef.current = false;
        runningTurnRef.current = null;
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    error: String(
                      (params.error as { message?: string } | undefined)?.message ??
                        params.message ??
                        "Codex 运行失败",
                    ),
                    activeTurn: null,
                  },
                }
              : session,
          ),
        }));
      }
    });
  }, [platform, setAppState, setRuntime]);

  return { sendingRef, runningTurnRef, threadSessionMapRef };
}
