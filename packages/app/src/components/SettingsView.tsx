import {
  ArrowLeft,
  Bot,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppSettings, ModelId, SkillInfo } from "@icode/platform";
import { MODEL_OPTIONS } from "../config/app";
import { usePlatform } from "../platform/PlatformContext";

export type SettingsSection = "general" | "codex" | "terminal" | "skills";

type SettingsViewProps = {
  initialSection?: SettingsSection;
  onClose: () => void;
  onDefaultModelChange: (model: ModelId) => void;
};

const sections: { id: SettingsSection; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "codex", label: "Codex", icon: Bot },
  { id: "terminal", label: "终端", icon: Terminal },
  { id: "skills", label: "Skills", icon: Sparkles },
];

const skillSourceLabels: Record<SkillInfo["source"], string> = {
  codex: "Codex",
  system: "系统",
  agents: "Agents",
  plugin: "插件",
};

export function SettingsView({
  initialSection = "general",
  onClose,
  onDefaultModelChange,
}: SettingsViewProps) {
  const platform = usePlatform();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsReloadKey, setSkillsReloadKey] = useState(0);

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

  useEffect(() => {
    if (activeSection !== "skills") return;
    let cancelled = false;
    setSkillsLoading(true);
    setSkillsError(null);
    void platform
      .listSkills()
      .then((loaded) => {
        if (!cancelled) setSkills(loaded);
      })
      .catch((caught) => {
        if (!cancelled) setSkillsError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, platform, skillsReloadKey]);

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

              {activeSection === "skills" && (
                <div className="skills-settings">
                  <div className="skills-summary">
                    <div>
                      <strong>{skills.length} 个 Skills</strong>
                      <span>来自本机 Codex、Agents 和插件目录</span>
                    </div>
                    <button
                      className="settings-control-button"
                      type="button"
                      disabled={skillsLoading}
                      onClick={() => setSkillsReloadKey((current) => current + 1)}
                    >
                      {skillsLoading ? "读取中" : "刷新"}
                    </button>
                  </div>

                  {skillsError && <div className="settings-error">{skillsError}</div>}
                  {!skillsError && skillsLoading && skills.length === 0 && (
                    <div className="settings-empty">正在读取 Skills</div>
                  )}
                  {!skillsError && !skillsLoading && skills.length === 0 && (
                    <div className="settings-empty">未发现本地 Skills</div>
                  )}
                  {skills.length > 0 && (
                    <div className="skill-list" aria-label="Skills 列表">
                      {skills.map((skill) => (
                        <div className="skill-item" key={skill.id}>
                          <div className="skill-copy">
                            <div className="skill-title-row">
                              <strong>{skill.name}</strong>
                              <span>
                                {skillSourceLabels[skill.source]}
                                {skill.packageName ? ` · ${skill.packageName}` : ""}
                              </span>
                            </div>
                            <p>{skill.description || "无描述"}</p>
                            <small title={skill.path}>{skill.path}</small>
                          </div>
                          <span className="skill-status">已安装</span>
                        </div>
                      ))}
                    </div>
                  )}
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
