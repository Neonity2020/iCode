const highlights = [
  { value: "Open Source", label: "开源可改造的 Codex 桌面端" },
  { value: "Desktop First", label: "围绕本地工作区设计" },
  { value: "Landing Page", label: "官网落地页展示项目方向" },
];

const features = [
  {
    eyebrow: "Workspace",
    title: "把 Codex 放进真实工作流",
    copy: "iCode 将 Codex CLI、工作区选择、文件树和任务对话放在同一个桌面界面里，减少上下文切换。",
  },
  {
    eyebrow: "Platform",
    title: "桌面能力一次接通",
    copy: "本地文件系统、PTY 终端、Finder 跳转和 Codex 审批请求都通过平台能力层统一接入。",
  },
  {
    eyebrow: "Website",
    title: "官网落地页和桌面端同仓维护",
    copy: "Web 目录当前承载项目介绍、能力展示和快速开始内容，不作为桌面工作台的 Web 版入口。",
  },
];

const proofPoints = [
  "开源仓库结构清晰，适合 Fork、定制和内部部署",
  "桌面端优先，聚合工作区、终端、文件树和审批流",
  "官网落地页展示产品方向，便于对外介绍和传播",
];

const capabilities = [
  {
    quote: "Codex 事件、状态变化和请求确认都会被统一收束到同一工作区界面，便于查看当前任务进度。",
    name: "统一事件层",
    role: "把通知、请求和错误放在一个入口里",
  },
  {
    quote: "桌面端可以直接接入本地文件系统和终端，把代码、命令和会话上下文放在一起处理。",
    name: "本地优先",
    role: "围绕真实开发环境构建交互",
  },
];

const steps = ["克隆仓库并安装依赖", "启动桌面端并连接 Codex CLI", "选择工作区后直接开始处理任务"];

export function LandingPage() {
  return (
    <div className="page-shell">
      <div className="page-glow page-glow-left" aria-hidden="true" />
      <div className="page-glow page-glow-right" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">iC</span>
          <span>
            iCode <small>Open-source Codex desktop</small>
          </span>
        </a>

        <nav className="nav">
          <a href="#features">能力</a>
          <a href="#proof">场景</a>
          <a href="#pricing">开始</a>
        </nav>

        <a className="topbar-cta" href="#pricing">
          立即开始
        </a>
      </header>

      <main id="top" className="main-grid">
        <section className="hero">
          <div className="eyebrow-pill">Open-source Codex desktop</div>
          <h1>
            让 Codex
            <span>进入你的桌面工作流。</span>
          </h1>
          <p className="hero-copy">
            iCode 是一个面向 Codex 的开源桌面端工作台。它把 Codex
            CLI、工作区文件树、终端、审批和会话状态放到同一个界面里，
            让你可以在本地直接接管任务、审阅变更并继续推进开发。
          </p>

          <div className="hero-actions">
            <a className="button button-primary" href="#pricing">
              查看快速开始
            </a>
            <a className="button button-secondary" href="#features">
              了解核心能力
            </a>
          </div>

          <dl className="highlight-row" aria-label="Key highlights">
            {highlights.map((item) => (
              <div className="highlight-card" key={item.label}>
                <dt>{item.value}</dt>
                <dd>{item.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="hero-panel" aria-label="iCode preview">
          <div className="preview-card">
            <div className="preview-header">
              <span className="status-dot" />
              <span>Desktop overview</span>
              <span className="preview-chip">Open source</span>
            </div>

            <div className="preview-body">
              <p className="preview-label">Core workflow</p>
              <h2>把 Codex、工作区和终端收进一个桌面应用。</h2>
              <p>
                从任务输入、模型选择、文件浏览到确认授权，iCode 让 Codex
                的每一步都在本地上下文中完成。
              </p>

              <div className="mini-grid">
                <div>
                  <strong>工作区</strong>
                  <span>本地目录选择与文件树</span>
                </div>
                <div>
                  <strong>终端</strong>
                  <span>PTY Shell 直连命令行</span>
                </div>
                <div>
                  <strong>审批</strong>
                  <span>Codex 请求透明可控</span>
                </div>
                <div>
                  <strong>共享层</strong>
                  <span>桌面与 Web 复用 UI</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="trust-strip" aria-label="Value propositions">
          {proofPoints.map((point) => (
            <div className="trust-item" key={point}>
              <span className="trust-bullet" aria-hidden="true" />
              <span>{point}</span>
            </div>
          ))}
        </section>

        <section id="features" className="section-card">
          <div className="section-heading">
            <p className="section-kicker">能力</p>
            <h2>补齐 Codex 桌面端。</h2>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <p className="feature-eyebrow">{feature.eyebrow}</p>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="proof" className="section-card proof-layout">
          <div className="section-heading">
            <p className="section-kicker">场景</p>
            <h2>本地工作区场景。</h2>
            <p className="section-copy">适合把任务、审阅、终端和文件操作放在一起。</p>
          </div>

          <div className="testimonial-stack">
            {capabilities.map((item) => (
              <blockquote className="testimonial" key={item.name}>
                <p className="testimonial-label">{item.name}</p>
                <p>{item.quote}</p>
                <footer>
                  <span>{item.role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section className="section-card process-layout">
          <div className="section-heading">
            <p className="section-kicker">开始</p>
            <h2>三步启动你的 iCode 桌面端。</h2>
          </div>

          <ol className="steps">
            {steps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="cta-card">
          <div>
            <p className="section-kicker">Get started</p>
            <h2>把 iCode 作为你的 Codex 桌面入口。</h2>
            <p>
              安装依赖，启动桌面端，连接你的 Codex
              环境后，就能在一个界面里完成任务输入、工作区操作和结果审阅。
            </p>
          </div>

          <div className="cta-actions">
            <a className="button button-primary" href="#features">
              查看能力
            </a>
            <a className="button button-secondary" href="#top">
              返回顶部
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
