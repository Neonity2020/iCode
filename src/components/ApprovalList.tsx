import type { Approval } from "../domain/types";
import { approvalCopy } from "../lib/codex";

type ApprovalListProps = {
  approvals: Approval[];
  onDecision: (approval: Approval, decision: "accept" | "decline") => void;
};

export function ApprovalList({ approvals, onDecision }: ApprovalListProps) {
  return approvals.map((approval) => {
    const copy = approvalCopy(approval);
    return (
      <div className="approval-card" key={approval.id}>
        <div>
          <strong>{copy.title}</strong>
          <code>{copy.detail}</code>
        </div>
        <div className="approval-actions">
          <button type="button" onClick={() => onDecision(approval, "decline")}>
            拒绝
          </button>
          <button className="approve" type="button" onClick={() => onDecision(approval, "accept")}>
            允许
          </button>
        </div>
      </div>
    );
  });
}
