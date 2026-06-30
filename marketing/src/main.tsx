import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import uiScreenshot from "./assets/icode-ui-screenshot.jpg";
import "./styles.css";

const operatingModes = [
  {
    label: "Code",
    title: "项目开发",
    copy: "读仓库、改代码、跑检查，把 Codex 的执行过程放进本地工作区。",
  },
  {
    label: "Research",
    title: "深度研究",
    copy: "收集材料、交叉验证、沉淀结论，把长任务拆成可追踪的步骤。",
  },
  {
    label: "Work",
    title: "日常工作",
    copy: "写文档、整理方案、处理资料，让 AI 从回答问题变成推进工作。",
  },
];

const pillars = [
  ["Local-first", "文件树、终端、审批和变更审阅都贴着本机工作区运行。"],
  ["Open Desktop", "基于开源 Codex CLI，把桌面工作台也放到社区可以改造的位置。"],
  ["Beyond coding", "不只写项目，也适合研究、文案、计划、资料处理和团队流程。"],
  ["Human control", "关键命令、权限和变更保持可见，让协作有速度也有边界。"],
];

const workflow = [
  "选择本地项目或资料目录",
  "把目标交给 Codex 拆解",
  "审阅命令、文件和结论",
  "沉淀成代码、文档或研究成果",
];

const stats = [
  ["43", "源码文件"],
  ["9167", "物理行"],
  ["8646", "非空行"],
];

function MarketingPage() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="iCode home">
          <span className="brand-mark">iC</span>
          <span>iCode</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#why">为什么</a>
          <a href="#workflow">工作流</a>
          <a href="#open">开源</a>
        </nav>
        <a className="header-action" href="https://github.com/Neonity2020/iCode">
          GitHub
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section id="top" className="hero-section">
          <figure className="hero-screenshot" aria-label="iCode desktop UI screenshot">
            <img src={uiScreenshot} alt="iCode 桌面应用真实界面截图" />
          </figure>
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow">Open-source Codex desktop</p>
            <h1>
              iCode
              <span>把 Codex 变成生产力工作台。</span>
            </h1>
            <p>
              Codex 不只是 AI 编程工具。它可以写项目，也可以做深度研究、整理资料、生成方案，
              甚至推进几乎一切需要读、查、写、改、验证的工作。
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="https://github.com/Neonity2020/iCode">
                查看源码
                <span aria-hidden="true">↗</span>
              </a>
              <a className="secondary-action" href="#why">
                了解 iCode
              </a>
            </div>
          </div>
        </section>

        <section className="ticker-band" aria-label="iCode operating modes">
          {operatingModes.map((mode) => (
            <article key={mode.label}>
              <span>{mode.label}</span>
              <h2>{mode.title}</h2>
              <p>{mode.copy}</p>
            </article>
          ))}
        </section>

        <section id="why" className="story-section">
          <div className="section-copy">
            <p className="eyebrow">Why iCode</p>
            <h2>CLI 是开源的，桌面体验也应该能被改造。</h2>
            <p>
              Codex CLI 已经给了开发者一个强大的本地执行入口。iCode 做的事情，是把工作区、
              文件树、终端、审批、会话状态和结果审阅收束进一个桌面界面，让 Codex 更像一个能
              参与真实工作的协作者。
            </p>
          </div>
          <div className="principle-grid">
            {pillars.map(([title, copy]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="workflow-section">
          <div className="section-copy">
            <p className="eyebrow">Workflow</p>
            <h2>从一个想法到可审阅结果。</h2>
          </div>
          <ol>
            {workflow.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section id="open" className="open-section">
          <div className="open-copy">
            <p className="eyebrow">Open source practice</p>
            <h2>我们用 Codex vibe coding 了一个开源 Desktop。</h2>
            <p>
              iCode 是一次产品实验：用 Codex 构建更适合 Codex 的桌面入口。它不是替代编辑器， 而是把
              AI 的执行过程、人的判断和本地环境放在同一个工作平面。
            </p>
          </div>
          <dl className="stat-grid">
            {stats.map(([value, label]) => (
              <div key={label}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}

const appElement = document.getElementById("app");
if (!appElement) throw new Error("Marketing app root is missing");

const rootScope = globalThis as typeof globalThis & { __icodeMarketingRoot?: Root };
const root = rootScope.__icodeMarketingRoot ?? createRoot(appElement);
rootScope.__icodeMarketingRoot = root;

root.render(
  <StrictMode>
    <MarketingPage />
  </StrictMode>,
);
