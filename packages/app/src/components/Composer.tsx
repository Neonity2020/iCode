import { ArrowUp, ChevronDown, Paperclip, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MODEL_OPTIONS } from "../config/app";
import type { ModelId, RuntimeStatus } from "../domain/types";

type ComposerProps = {
  value: string;
  selectedModel: ModelId;
  runtime: RuntimeStatus;
  runtimeLabel: string;
  active: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onSelectModel: (model: ModelId) => void;
  onInterrupt: () => void;
};

export function Composer({
  value,
  selectedModel,
  runtime,
  runtimeLabel,
  active,
  onChange,
  onSubmit,
  onSelectModel,
  onInterrupt,
}: ComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    MODEL_OPTIONS.find((option) => option.id === selectedModel) ?? MODEL_OPTIONS[0];

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
          onChange={(event) => onChange(event.target.value)}
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
            <button
              className="send-button"
              type="submit"
              disabled={!value.trim() || runtime.state !== "ready"}
              aria-label="发送"
            >
              <ArrowUp size={17} />
            </button>
          )}
        </div>
      </form>
      <p className="composer-hint">Codex 可在当前工作区修改文件；需要额外权限时会请求确认。</p>
    </div>
  );
}
