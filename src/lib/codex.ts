import type { Activity, Approval, CodexItem } from "../domain/types";

export function stringifyDetail(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyDetail).filter(Boolean).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

export function describeItem(item: CodexItem): Omit<Activity, "id" | "status"> {
  switch (item.type) {
    case "commandExecution":
      return { title: "运行命令", detail: stringifyDetail(item.command) };
    case "fileChange":
      return { title: "修改文件", detail: stringifyDetail(item.changes) };
    case "mcpToolCall":
      return { title: `调用 ${String(item.server ?? "MCP")}`, detail: String(item.tool ?? "工具") };
    case "dynamicToolCall":
      return { title: "调用工具", detail: String(item.tool ?? "") };
    case "webSearch":
      return { title: "搜索网页", detail: String(item.query ?? "") };
    case "reasoning":
      return { title: "分析任务", detail: "Codex 正在推理" };
    case "plan":
      return { title: "更新计划", detail: String(item.text ?? "") };
    default:
      return { title: "Codex 活动", detail: String(item.type ?? "处理中") };
  }
}

export function approvalCopy(approval: Approval) {
  if (approval.method === "item/commandExecution/requestApproval") {
    return { title: "允许运行命令？", detail: stringifyDetail(approval.params.command) };
  }
  if (approval.method === "item/fileChange/requestApproval") {
    return {
      title: "允许修改文件？",
      detail: String(approval.params.reason ?? "Codex 请求写入工作区"),
    };
  }
  return { title: "Codex 需要确认", detail: String(approval.params.reason ?? approval.method) };
}

export function summarizeActivityDetail(detail: string, maxLength = 88) {
  const normalized = detail.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function summarizeActivityBundle(activities: Activity[]) {
  if (activities.length === 0) return "暂无执行记录";
  const inProgressCount = activities.filter((activity) => activity.status === "inProgress").length;
  const recentTitles = activities
    .slice(-3)
    .map((activity) => activity.title)
    .filter((title, index, all) => all.indexOf(title) === index);
  const recentText = recentTitles.length > 0 ? recentTitles.join(" · ") : "执行已完成";
  return inProgressCount > 0 ? `${recentText} · ${inProgressCount} 个进行中` : recentText;
}
