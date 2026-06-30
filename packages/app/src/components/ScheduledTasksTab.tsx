import { CalendarClock, Check, Pencil, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ScheduledTask } from "../domain/types";

export type ScheduledTaskInput = {
  title: string;
  prompt: string;
  schedule: ScheduledTask["schedule"];
  intervalMinutes: number;
  nextRunAt: string;
};

type ScheduledTasksTabProps = {
  tasks: ScheduledTask[];
  onCreate: (task: ScheduledTaskInput) => void;
  onUpdate: (id: string, patch: Partial<ScheduledTask>) => void;
  onDelete: (id: string) => void;
  onRunNow: (id: string) => void;
};

function toDateTimeLocal(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value?: string) {
  if (!value) return "从未";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(task: ScheduledTask) {
  if (task.lastStatus === "running") return "运行中";
  if (!task.enabled) return "已暂停";
  if (task.lastStatus === "failed") return "失败";
  if (task.lastStatus === "completed") return "已触发";
  return "等待中";
}

export function ScheduledTasksTab({
  tasks,
  onCreate,
  onUpdate,
  onDelete,
  onRunNow,
}: ScheduledTasksTabProps) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [schedule, setSchedule] = useState<ScheduledTask["schedule"]>("interval");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [nextRunAt, setNextRunAt] = useState(() => toDateTimeLocal(new Date(Date.now() + 60 * 60_000)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ScheduledTaskInput | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedPrompt = prompt.trim();
    const runAt = new Date(nextRunAt);
    if (!trimmedTitle || !trimmedPrompt || !Number.isFinite(runAt.getTime())) return;
    onCreate({
      title: trimmedTitle,
      prompt: trimmedPrompt,
      schedule,
      intervalMinutes: Math.max(1, Math.round(intervalMinutes)),
      nextRunAt: runAt.toISOString(),
    });
    setTitle("");
    setPrompt("");
  }

  function startEdit(task: ScheduledTask) {
    setEditingId(task.id);
    setEditDraft({
      title: task.title,
      prompt: task.prompt,
      schedule: task.schedule,
      intervalMinutes: task.intervalMinutes,
      nextRunAt: toDateTimeLocal(task.nextRunAt),
    });
  }

  function saveEdit(id: string) {
    if (!editDraft) return;
    const title = editDraft.title.trim();
    const prompt = editDraft.prompt.trim();
    const runAt = new Date(editDraft.nextRunAt);
    if (!title || !prompt || !Number.isFinite(runAt.getTime())) return;
    onUpdate(id, {
      title,
      prompt,
      schedule: editDraft.schedule,
      intervalMinutes: Math.max(1, Math.round(editDraft.intervalMinutes)),
      nextRunAt: runAt.toISOString(),
      lastError: undefined,
      lastStatus: "idle",
    });
    setEditingId(null);
    setEditDraft(null);
  }

  return (
    <section className="schedule-pane">
      <form className="schedule-form" onSubmit={submit}>
        <div className="schedule-form-title">
          <CalendarClock size={14} />
          <span>定时任务</span>
        </div>
        <input
          aria-label="任务名称"
          required
          placeholder="任务名称"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          aria-label="任务提示词"
          required
          placeholder="要定时交给 Codex 的任务"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="schedule-form-grid">
          <label>
            <span>频率</span>
            <select
              value={schedule}
              onChange={(event) => setSchedule(event.target.value as ScheduledTask["schedule"])}
            >
              <option value="interval">每 N 分钟</option>
              <option value="daily">每天</option>
            </select>
          </label>
          {schedule === "interval" && (
            <label>
              <span>间隔分钟</span>
              <input
                min={1}
                required
                type="number"
                value={intervalMinutes}
                onChange={(event) => setIntervalMinutes(Number(event.target.value) || 1)}
              />
            </label>
          )}
          <label>
            <span>{schedule === "daily" ? "首次运行" : "下次运行"}</span>
            <input
              type="datetime-local"
              required
              value={nextRunAt}
              onChange={(event) => setNextRunAt(event.target.value)}
            />
          </label>
        </div>
        <button className="schedule-create" type="submit">
          <Plus size={13} /> <span>添加任务</span>
        </button>
      </form>

      <div className="schedule-list" aria-label="定时任务列表">
        {tasks.length === 0 ? (
          <div className="schedule-empty">暂无定时任务</div>
        ) : (
          tasks.map((task) => (
            <article className={`schedule-card status-${task.lastStatus}`} key={task.id}>
              {editingId === task.id && editDraft ? (
                <div className="schedule-edit">
                  <input
                    aria-label="编辑任务名称"
                    value={editDraft.title}
                    onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}
                  />
                  <textarea
                    aria-label="编辑任务提示词"
                    value={editDraft.prompt}
                    onChange={(event) => setEditDraft({ ...editDraft, prompt: event.target.value })}
                  />
                  <div className="schedule-form-grid">
                    <label>
                      <span>频率</span>
                      <select
                        value={editDraft.schedule}
                        onChange={(event) =>
                          setEditDraft({
                            ...editDraft,
                            schedule: event.target.value as ScheduledTask["schedule"],
                          })
                        }
                      >
                        <option value="interval">每 N 分钟</option>
                        <option value="daily">每天</option>
                      </select>
                    </label>
                    {editDraft.schedule === "interval" && (
                      <label>
                        <span>间隔分钟</span>
                        <input
                          min={1}
                          type="number"
                          value={editDraft.intervalMinutes}
                          onChange={(event) =>
                            setEditDraft({
                              ...editDraft,
                              intervalMinutes: Number(event.target.value) || 1,
                            })
                          }
                        />
                      </label>
                    )}
                    <label>
                      <span>{editDraft.schedule === "daily" ? "首次运行" : "下次运行"}</span>
                      <input
                        type="datetime-local"
                        value={editDraft.nextRunAt}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, nextRunAt: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="schedule-edit-actions">
                    <button type="button" onClick={() => saveEdit(task.id)}>
                      <Check size={13} /> <span>保存</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                    >
                      <X size={13} /> <span>取消</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="schedule-card-head">
                    <div>
                      <strong>{task.title}</strong>
                      <span>{statusLabel(task)}</span>
                    </div>
                    <div className="schedule-actions">
                      <button
                        type="button"
                        title="立即运行"
                        aria-label={`立即运行 ${task.title}`}
                        onClick={() => onRunNow(task.id)}
                        disabled={task.lastStatus === "running"}
                      >
                        <Play size={13} />
                      </button>
                      <button
                        type="button"
                        title={task.enabled ? "暂停" : "启用"}
                        aria-label={task.enabled ? `暂停 ${task.title}` : `启用 ${task.title}`}
                        onClick={() => onUpdate(task.id, { enabled: !task.enabled })}
                      >
                        {task.enabled ? <Pause size={13} /> : <CalendarClock size={13} />}
                      </button>
                      <button
                        type="button"
                        title="编辑"
                        aria-label={`编辑 ${task.title}`}
                        onClick={() => startEdit(task)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        title="删除"
                        aria-label={`删除 ${task.title}`}
                        onClick={() => onDelete(task.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p>{task.prompt}</p>
                  <dl>
                    <div>
                      <dt>间隔</dt>
                      <dd>{task.schedule === "daily" ? "每天" : `${task.intervalMinutes} 分钟`}</dd>
                    </div>
                    <div>
                      <dt>下次</dt>
                      <dd>{formatDate(task.nextRunAt)}</dd>
                    </div>
                    <div>
                      <dt>上次</dt>
                      <dd>{formatDate(task.lastRunAt)}</dd>
                    </div>
                  </dl>
                  {task.lastError && <small>{task.lastError}</small>}
                </>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
