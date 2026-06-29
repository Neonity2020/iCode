import type { ModelId } from "../domain/types";

export const STORAGE_KEY = "icode.conversations.v2";

export const DEFAULT_MODEL: ModelId = "gpt-5.5";

export const MODEL_OPTIONS: { id: ModelId; label: string; detail: string }[] = [
  { id: "gpt-5.5", label: "GPT-5.5", detail: "复杂任务" },
  { id: "gpt-5.4", label: "GPT-5.4", detail: "均衡" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", detail: "更快" },
];

export const PANEL_WIDTHS = {
  left: { default: 264, min: 220, max: 420 },
  right: { default: 320, min: 260, max: 520 },
} as const;
