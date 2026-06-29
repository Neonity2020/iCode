import { ArrowUp, ChevronDown, FileText, Paperclip, Square } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { MODEL_OPTIONS } from "../config/app";
import type { ModelId, RuntimeStatus } from "../domain/types";

export type ComposerAttachment = {
  id: string;
  kind: "image" | "file";
  name: string;
  url?: string;
  text?: string;
  status: "loading" | "ready" | "error";
};

type ComposerProps = {
  value: string;
  attachments: ComposerAttachment[];
  selectedModel: ModelId;
  runtime: RuntimeStatus;
  runtimeLabel: string;
  active: boolean;
  onChange: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent) => void;
  onAttachFiles: () => void;
  onSelectModel: (model: ModelId) => void;
  onInterrupt: () => void;
  onRemoveAttachment: (id: string) => void;
};

export function Composer({
  value,
  attachments,
  selectedModel,
  runtime,
  runtimeLabel,
  active,
  onChange,
  onPaste,
  onSubmit,
  onAttachFiles,
  onSelectModel,
  onInterrupt,
  onRemoveAttachment,
}: ComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    MODEL_OPTIONS.find((option) => option.id === selectedModel) ?? MODEL_OPTIONS[0];
  const loadingAttachments = attachments.some((attachment) => attachment.status === "loading");
  const readyAttachments = attachments.filter((attachment) => attachment.status === "ready");
  const sendDisabled =
    runtime.state !== "ready" ||
    loadingAttachments ||
    (!value.trim() && readyAttachments.length === 0);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={onSubmit}>
        <textarea
          aria-label="任务描述"
          placeholder={
            runtime.state === "ready" ? "描述一个任务，Codex 将在工作区中执行" : runtimeLabel
          }
          value={value}
          disabled={runtime.state !== "ready"}
          onPaste={onPaste}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {attachments.length > 0 && (
          <div className="composer-attachments" aria-label="已附加文件">
            {attachments.map((attachment, index) => (
              <div className={`composer-attachment ${attachment.status}`} key={attachment.id}>
                <button
                  className="composer-attachment-remove"
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  aria-label={`移除图片 ${index + 1}`}
                  >
                  ×
                </button>
                {attachment.kind === "image" ? (
                  <img src={attachment.url} alt={attachment.name ?? `图片 ${index + 1}`} />
                ) : (
                  <div className="composer-attachment-file">
                    <FileText size={18} />
                    <span>{attachment.name}</span>
                  </div>
                )}
                <span className="composer-attachment-state">
                  {attachment.status === "loading"
                    ? "读取中"
                    : attachment.status === "error"
                      ? "读取失败"
                      : attachment.kind === "image"
                        ? "图片"
                        : "文件"}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="composer-toolbar">
          <div>
            <button className="tool-button" type="button" onClick={onAttachFiles} aria-label="添加附件">
              <Paperclip size={16} />
            </button>
            <div className="model-picker" ref={pickerRef}>
              <button
                className="model-button"
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {selectedOption.label} <ChevronDown size={13} />
              </button>
              {menuOpen && (
                <div className="model-menu" role="menu">
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      className={option.id === selectedModel ? "selected" : ""}
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={option.id === selectedModel}
                      onClick={() => {
                        onSelectModel(option.id);
                        setMenuOpen(false);
                      }}
                    >
                      <span>{option.label}</span>
                      <small>{option.detail}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="composer-context">
            workspace-write <span>·</span> {selectedModel}
          </div>
          {active ? (
            <button
              className="send-button stop"
              type="button"
              onClick={onInterrupt}
              aria-label="停止"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button className="send-button" type="submit" disabled={sendDisabled} aria-label="发送">
              <ArrowUp size={17} />
            </button>
          )}
        </div>
      </form>
      <p className="composer-hint">Codex 可在当前工作区修改文件；需要额外权限时会请求确认。</p>
    </div>
  );
}
