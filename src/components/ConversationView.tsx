import { Sparkles } from "lucide-react";
import type { RefObject } from "react";
import type { Activity, Approval, Message } from "../domain/types";
import { ActivityBundle } from "./ActivityBundle";
import { ApprovalList } from "./ApprovalList";
import { MarkdownContent } from "./MarkdownContent";

type ConversationViewProps = {
  containerRef: RefObject<HTMLElement | null>;
  messages: Message[];
  activities: Activity[];
  approvals: Approval[];
  error: string | null;
  activityBundleExpanded: boolean;
  expandedActivityIds: Record<string, boolean>;
  onToggleActivityBundle: () => void;
  onToggleActivity: (id: string, expanded: boolean) => void;
  onApprovalDecision: (approval: Approval, decision: "accept" | "decline") => void;
};

export function ConversationView({
  containerRef,
  messages,
  activities,
  approvals,
  error,
  activityBundleExpanded,
  expandedActivityIds,
  onToggleActivityBundle,
  onToggleActivity,
  onApprovalDecision,
}: ConversationViewProps) {
  const empty = messages.length === 0 && activities.length === 0;

  return (
    <section className="conversation" ref={containerRef}>
      <div className="message-column">
        {empty ? (
          <>
            <div className="empty-state">
              <span>
                <Sparkles size={21} />
              </span>
              <h1>让 Codex 处理一个任务</h1>
              <p>Codex CLI 将在当前工作区真实读取、运行和修改文件。</p>
            </div>
            {error && <div className="error-card">{error}</div>}
          </>
        ) : (
          <>
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                {message.role === "assistant" && (
                  <div className="assistant-mark">
                    <Sparkles size={14} />
                  </div>
                )}
                <div className="message-content">
                  {message.content ? (
                    <MarkdownContent>{message.content}</MarkdownContent>
                  ) : (
                    <span className="typing">Codex 正在思考…</span>
                  )}
                </div>
              </article>
            ))}

            {activities.length > 0 && (
              <ActivityBundle
                activities={activities}
                expanded={activityBundleExpanded}
                expandedItems={expandedActivityIds}
                onToggleBundle={onToggleActivityBundle}
                onToggleItem={onToggleActivity}
              />
            )}

            <ApprovalList approvals={approvals} onDecision={onApprovalDecision} />
            {error && <div className="error-card">{error}</div>}
          </>
        )}
      </div>
    </section>
  );
}
