import { ArrowLeft, Bot, RotateCcw, Settings, SlidersHorizontal, Terminal } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppSettings, ModelId } from "@icode/platform";
import { MODEL_OPTIONS } from "../config/app";
import { usePlatform } from "../platform/PlatformContext";

type SettingsSection = "general" | "codex" | "terminal";

type SettingsViewProps = {
  onClose: () => void;
  onDefaultModelChange: (model: ModelId) => void;
};

const sections: { id: SettingsSection; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "codex", label: "Codex", icon: Bot },
  { id: "terminal", label: "终端", icon: Terminal },
];

export function SettingsView({ onClose, onDefaultModelChange }: SettingsViewProps) {
  const platform = usePlatform();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void platform
      .getSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        onDefaultModelChange(loaded.defaultModel);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [onDefaultModelChange, platform]);

  const activeTitle = useMemo(
    () => sections.find((section) => section.id === activeSection)?.label ?? "设置",
    [activeSection],
  );

  async function updateSettings(patch: Partial<AppSettings>) {
    if (!settings) return;
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    if (patch.defaultModel) onDefaultModelChange(patch.defaultModel);
    setSaving(true);
    setError(null);
    try {
      const saved = await platform.updateSettings(patch);
      setSettings(saved);
      onDefaultModelChange(saved.defaultModel);
    } catch (caught) {
      setSettings(settings);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  async function resetSettings() {
    setSaving(true);
    setError(null);
    try {
      const next = await platform.resetSettings();
      setSettings(next);
      onDefaultModelChange(next.defaultModel);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="traffic-light-space" />
        <button className="settings-back" type="button" onClick={onClose}>
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>
        <div className="settings-heading">
          <Settings size={17} />
          <strong>设置</strong>
        </div>
        <nav className="settings-nav" aria-label="设置">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                className={section.id === activeSection ? "active" : ""}
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
              >
                <Icon size={16} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="settings-main">
        <header className="settings-titlebar">
          <strong>{activeTitle}</strong>
          <button className="settings-reset" type="button" onClick={() => void resetSettings()}>
            <RotateCcw size={15} />
            <span>恢复默认</span>
          </button>
        </header>

        <section className="settings-content">
          {!settings && !error && <div className="settings-empty">正在读取设置</div>}
          {error && <div className="settings-error">{error}</div>}
          {settings && (
            <>
              {activeSection === "general" && (
                <div className="settings-group">
                  <SettingRow title="默认模型" detail="新任务和 composer 默认使用的模型">
                    <select
                      value={settings.defaultModel}
                      onChange={(event) =>
                        void updateSettings({ defaultModel: event.target.value as ModelId })
                      }
                      disabled={saving}
                    >
                      {MODEL_OPTIONS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </SettingRow>
                </div>
              )}

              {activeSection === "codex" && (
                <div className="settings-group">
                  <SettingRow
                    title="Codex CLI 路径"
                    detail="留空时自动从系统路径和默认安装位置查找"
                  >
                    <input
                      value={settings.codexCliPath}
                      disabled={saving}
                      placeholder="/opt/homebrew/bin/codex"
                      onChange={(event) =>
                        void updateSettings({ codexCliPath: event.target.value })
                      }
                    />
                  </SettingRow>
                </div>
              )}

              {activeSection === "terminal" && (
                <div className="settings-group">
                  <SettingRow
                    title="终端 Shell"
                    detail="新打开的终端会使用这个 shell，留空时使用默认值"
                  >
                    <input
                      value={settings.terminalShell}
                      disabled={saving}
                      placeholder="/bin/zsh"
                      onChange={(event) =>
                        void updateSettings({ terminalShell: event.target.value })
                      }
                    />
                  </SettingRow>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function SettingRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div className="settings-control">{children}</div>
    </div>
  );
}
