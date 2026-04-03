# Website Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the personal site to Academic Blue serif style, extract all content into a `content/` directory, and add per-project detail pages with Markdown-driven rich content.

**Architecture:** Vite + React SPA, no routing today → add React Router v6 (HashRouter for gh-pages compatibility). All structured data (profile, education, skills) moves to `content/*.js` ES modules; project data lives in `content/projects/*.md` files parsed at runtime with `gray-matter` + rendered with `react-markdown`.

**Tech Stack:** React 18, Vite 5, react-router-dom v6, gray-matter, react-markdown, remark-gfm

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/index.css` | Modify | Global tokens: Academic Blue colors, Georgia font stack |
| `src/App.css` | Modify | `.section-title` serif style, remove gradient text |
| `src/App.jsx` | Modify | Wrap with `HashRouter`, add `/projects/:slug` route |
| `src/components/Navbar.jsx` | Modify | Read logo from profile, Academic Blue style |
| `src/components/Navbar.css` | Modify | Serif logo, uppercase nav links, no gradient |
| `src/components/Hero.jsx` | Modify | Bilingual layout, data from `content/profile.js` |
| `src/components/Hero.css` | Modify | Remove gradient bg/text, Academic Blue style |
| `src/components/Education.jsx` | Modify | Bilingual expanded entries, data from `content/education.js` |
| `src/components/Education.css` | Modify | Remove timeline gradient, flat list style |
| `src/components/Projects.jsx` | Modify | Cards link to `/projects/:slug`, data from MD glob |
| `src/components/Projects.css` | Modify | Academic Blue card style |
| `src/components/Skills.jsx` | Modify | Data from `content/skills.js` |
| `src/components/Skills.css` | Modify | Academic Blue pill style |
| `src/components/Footer.jsx` | Modify | Academic Blue style |
| `src/components/Footer.css` | Modify | Academic Blue style |
| `src/components/ProjectDetail.jsx` | **Create** | Detail page: breadcrumb, cover, MD body |
| `src/components/ProjectDetail.css` | **Create** | Detail page styles |
| `content/profile.js` | **Create** | Personal info: name, bio ZH/EN, links |
| `content/education.js` | **Create** | Education entries array |
| `content/skills.js` | **Create** | Skill groups array |
| `content/projects/ergokare.md` | **Create** | ErgoKARE frontmatter + MD body |
| `content/projects/diamaid.md` | **Create** | DiaMaid frontmatter + MD body |
| `content/projects/driving-assistant.md` | **Create** | Driving assistant frontmatter + MD body |
| `content/projects/hci-llm.md` | **Create** | HCI LLM frontmatter + MD body |
| `content/projects/xingshixian.md` | **Create** | 星世线 frontmatter + MD body |
| `vite.config.js` | Modify | Keep `base: '/'`, no other changes needed |
| `.gitignore` | Modify | Add `.superpowers/` |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new packages**

```bash
cd "D:/研究生/yanjieZJU.github.io"
npm install react-router-dom gray-matter react-markdown remark-gfm
```

Expected output: packages added, no peer dep errors.

- [ ] **Step 2: Verify installed**

```bash
grep -E "react-router-dom|gray-matter|react-markdown|remark-gfm" package.json
```

Expected: all 4 packages appear in `dependencies`.

- [ ] **Step 3: Add .superpowers to .gitignore**

Open `.gitignore` (or create it if absent). Add at the end:
```
.superpowers/
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add react-router-dom, gray-matter, react-markdown, remark-gfm"
```

---

## Task 2: Global theme — Academic Blue tokens

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`

- [ ] **Step 1: Replace `src/index.css`**

Replace the entire file content:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-bg: #fafafa;
  --color-bg-alt: #f4f6f9;
  --color-text: #1a1a1a;
  --color-text-secondary: #555555;
  --color-accent: #2c4a7c;
  --color-border: #dde3ee;
  --color-tag-bg: #eef2f9;
  --color-award-bg: #fef9ec;
  --color-award-text: #92400e;
  --font-serif: Georgia, 'Times New Roman', serif;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  --nav-height: 56px;
  --radius: 4px;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-serif);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.fade-up {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 2: Replace `src/App.css`**

Replace the entire file content:

```css
.section {
  padding: 80px 24px;
  max-width: 900px;
  margin: 0 auto;
}

.section-alt {
  background: var(--color-bg-alt);
}

.section-heading {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
  padding-bottom: 6px;
  margin-bottom: 40px;
}
```

- [ ] **Step 3: Start dev server and verify no crash**

```bash
npm run dev
```

Open `http://localhost:5173` — page loads (may look broken, that's fine at this stage).

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/App.css
git commit -m "style: replace color tokens with Academic Blue theme"
```

---

## Task 3: Content files — profile, education, skills

**Files:**
- Create: `content/profile.js`
- Create: `content/education.js`
- Create: `content/skills.js`

- [ ] **Step 1: Create `content/profile.js`**

```js
export default {
  nameZh: '颜婕',
  nameEn: 'Yanjie',
  affiliationZh: '浙江大学计算机科学与技术学院 · 设计学 硕士',
  affiliationEn: 'Zhejiang University · M.S. in Design',
  bioZh: '人与AI交互设计研究者，关注大模型在设计支持、体验评估与智能交互中的应用。',
  bioEn: 'Researcher in Human-AI Interaction, focusing on LLM applications in design support, experience evaluation, and intelligent interaction systems.',
  email: 'yanjie02@zju.edu.cn',
  github: 'https://github.com/yanjieZJU',
  scholar: '',
  cv: '',
}
```

- [ ] **Step 2: Create `content/education.js`**

```js
export default [
  {
    schoolZh: '浙江大学计算机科学与技术学院',
    schoolEn: 'Zhejiang University, School of Computer Science',
    degreeZh: '设计学 · 硕士（保研）',
    degreeEn: 'M.S. in Design',
    period: '2024.09 — 2027.06',
    descZh: '研究方向：人与AI交互，关注大模型在设计支持、体验评估与智能交互中的应用',
    descEn: 'Research: Human-AI Interaction, LLM applications in design support & intelligent interaction',
    awards: ['优秀研究生', '五好研究生'],
  },
  {
    schoolZh: '浙江大学计算机科学与技术学院',
    schoolEn: 'Zhejiang University, School of Computer Science',
    degreeZh: '工业设计 · 本科（GPA 4.48/5.00，Top 15%）',
    degreeEn: 'B.Eng. in Industrial Design · GPA 4.48/5.00 (Top 15%)',
    period: '2020.09 — 2024.06',
    descZh: '主修课程：信息交互设计技术、用户体验与产品创新设计、数据结构基础、设计心理学',
    descEn: 'Key courses: Information Interaction Design, UX & Product Innovation, Data Structures, Design Psychology',
    awards: ['浙江省政府奖学金 ×2', '校级二等奖学金', '校级优秀毕业生', '浙江省第十三届挑战杯金奖'],
  },
]
```

- [ ] **Step 3: Create `content/skills.js`**

```js
export default [
  {
    title: '语言能力 / Language',
    pills: ['英语 CET-6（615）', 'English CET-6 (615)'],
  },
  {
    title: '产品技能 / Product',
    pills: ['用户调研', '需求分析', '交互原型设计', 'Figma', '数据分析（SPSS）'],
  },
  {
    title: 'AI 产品能力 / AI',
    pills: ['Prompt 设计', 'RAG', '指令微调', 'AI Agent 编排（Coze）', 'AIGC 工具（ComfyUI）'],
  },
  {
    title: '开发协作 / Dev',
    pills: ['AI 编程工具', 'TRAE', 'Git'],
  },
]
```

- [ ] **Step 4: Commit**

```bash
git add content/
git commit -m "feat: add content/ directory with profile, education, skills data"
```

---

## Task 4: Project Markdown files

**Files:**
- Create: `content/projects/ergokare.md`
- Create: `content/projects/diamaid.md`
- Create: `content/projects/driving-assistant.md`
- Create: `content/projects/hci-llm.md`
- Create: `content/projects/xingshixian.md`

- [ ] **Step 1: Create `content/projects/ergokare.md`**

```markdown
---
title_zh: "基于LLM的人体工效学风险预筛助手"
title_en: "ErgoKARE: LLM-Powered Ergonomic Risk Screening Assistant"
period: "2024.10 — 2025.11"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["LLM", "RAG", "GPT-4o", "Prompt Engineering", "工效学"]
cover: ""
github: "https://github.com/yanjieZJU/ErgoKARE"
paper: ""
order: 1
---

## Abstract / 摘要

针对工业场景工效学评估高度依赖人工分析的问题，以知识增强LLM辅助系统替代人工筛查，构建297条高频干预方案知识库，基准准确率提升8.7%，建议有效性提升16.1%，70.8%方案获领域专家偏好。

Industrial ergonomic assessment relies heavily on manual expert analysis. We propose ErgoKARE, a knowledge-augmented LLM system that automates ergonomic risk screening. We built a 297-entry high-frequency intervention knowledge base, achieving +8.7% baseline accuracy, +16.1% recommendation effectiveness, with 70.8% of suggestions preferred by domain experts.

## System Overview

<!-- Add architecture diagram here: ![Architecture](/images/ergokare-arch.png) -->

The system follows a RAG pipeline: user inputs a workplace scenario description → retrieval from the intervention knowledge base → GPT-4o generates risk assessment and intervention suggestions → expert validation loop.

## Key Results / 核心成果

- 构建 297 条高频干预方案知识库 / 297-entry intervention knowledge base
- 基准准确率提升 8.7% / +8.7% baseline accuracy
- 建议有效性提升 16.1% / +16.1% recommendation effectiveness  
- 70.8% 方案获领域专家偏好 / 70.8% suggestions preferred by domain experts

## Implementation Details

- **LLM backbone:** GPT-4o with structured prompt engineering
- **Knowledge base:** 297 curated ergonomic intervention strategies
- **RAG pipeline:** Semantic retrieval + contextual generation
- **Evaluation:** Expert study (n=24) with comparative analysis against baseline
```

- [ ] **Step 2: Create `content/projects/diamaid.md`**

```markdown
---
title_zh: "DiaMaid：系统设计架构图智能助手"
title_en: "DiaMaid: AI-Driven System Architecture Diagram Assistant"
period: "2025.12 — 至今"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["Multi-Agent", "LLM", "React", "FastAPI", "React Flow", "Mermaid.js"]
cover: ""
github: "https://github.com/yanjieZJU/DiaMaid"
paper: ""
order: 2
---

## Abstract / 摘要

面向研究者与开发者的AI驱动系统架构图生成工具，输入自然语言描述即可生成多视角专业架构方案。结合LLM与Multi-Agent协作，支持对话式编辑、可视化工作区与Word报告导出。

DiaMaid is an AI-driven tool for researchers and developers to generate professional system architecture diagrams from natural language descriptions. It leverages LLM + Multi-Agent collaboration, supporting conversational editing, a visual workspace, and Word report export.

## System Overview

<!-- Add architecture diagram here: ![Architecture](/images/diamaid-arch.png) -->

Multi-Agent pipeline: Planner agent decomposes the input → Diagram agent generates multi-view architecture → Editor agent handles conversational refinement → Export agent produces Word reports.

## Key Results / 核心成果

- 自然语言 → 多视角专业架构图 / Natural language → multi-view architecture diagrams
- 支持对话式编辑 / Conversational editing support
- Word 报告一键导出 / One-click Word report export

## Implementation Details

- **Frontend:** React + React Flow + Mermaid.js
- **Backend:** FastAPI
- **AI layer:** Multi-Agent orchestration with LLM backbone
- **Export:** Docx generation for Word reports
```

- [ ] **Step 3: Create `content/projects/driving-assistant.md`**

```markdown
---
title_zh: "基于LLM的说服式语音驾驶助手"
title_en: "Persuasive Voice Driving Assistant Based on LLM"
period: "2023.06 — 2023.09"
role_zh: "项目核心成员"
role_en: "Core Member · IEEE SMC 2025"
tags: ["LLM", "Prompt Engineering", "HCI", "IEEE SMC 2025", "自动驾驶"]
cover: ""
github: "https://github.com/yanjieZJU"
paper: ""
order: 3
---

## Abstract / 摘要

面向L3自动驾驶场景的说服式语音驾驶助手，设计六类说话策略与LLM语言生成方案，在模拟驾驶实验中显著降低用户认知负荷，有用性提升11.7%，易用性提升30.4%，行为意愿提升5.4%。

A persuasive voice driving assistant for L3 autonomous driving scenarios. We designed six persuasion strategy categories and an LLM-based language generation framework. Simulated driving experiments showed significant reduction in cognitive load, with +11.7% perceived usefulness, +30.4% ease of use, +5.4% behavioral intention.

## System Overview

<!-- Add system diagram here -->

Six persuasion strategies were designed and mapped to LLM prompt templates. The system selects the appropriate strategy based on driving context and generates natural language utterances.

## Key Results / 核心成果

- 有用性提升 11.7% / +11.7% perceived usefulness
- 易用性提升 30.4% / +30.4% ease of use
- 行为意愿提升 5.4% / +5.4% behavioral intention
- Published: IEEE SMC 2025

## Implementation Details

- **Persuasion strategies:** 6 strategy categories (ethos, pathos, logos, etc.)
- **LLM generation:** Prompt engineering for contextual utterance generation
- **Evaluation:** Simulated driving experiment with user study
```

- [ ] **Step 4: Create `content/projects/hci-llm.md`**

```markdown
---
title_zh: "HCI领域大语言模型构建"
title_en: "Domain-Specific LLM Fine-tuning for HCI"
period: "2024.10 — 2025.12"
role_zh: "项目核心成员"
role_en: "Core Member"
tags: ["SFT", "LoRA", "DPO", "LLaMA-Factory", "Llama-3", "Qwen2.5"]
cover: ""
github: "https://github.com/yanjieZJU"
paper: ""
order: 4
---

## Abstract / 摘要

面向HCI设计任务的垂类模型微调，将12,743篇HCI论文转化为双级指令微调数据集（Task-to-Requirement + Requirement-to-Concept），研究对比SFT、LoRA、DPO等方案，基于LLaMA-Factory完成完整微调链路。

Domain-specific LLM fine-tuning for HCI design tasks. We converted 12,743 HCI papers into a two-level instruction-tuning dataset (Task-to-Requirement + Requirement-to-Concept), compared SFT, LoRA, and DPO approaches, and completed a full fine-tuning pipeline using LLaMA-Factory.

## System Overview

<!-- Add pipeline diagram here -->

Two-level dataset construction pipeline: paper parsing → task extraction → requirement decomposition → concept mapping. Fine-tuning pipeline: data preprocessing → SFT/LoRA/DPO training → evaluation.

## Key Results / 核心成果

- 12,743 篇 HCI 论文转化为指令微调数据集
- 双级数据集：Task-to-Requirement + Requirement-to-Concept
- 完整对比 SFT、LoRA、DPO 三类方案

## Implementation Details

- **Base models:** Llama-3, Qwen2.5
- **Fine-tuning framework:** LLaMA-Factory
- **Methods compared:** SFT, LoRA, DPO
- **Dataset:** 12,743 HCI papers → dual-level instruction pairs
```

- [ ] **Step 5: Create `content/projects/xingshixian.md`**

```markdown
---
title_zh: "星世线小程序增长与体验优化"
title_en: "Xingshixian Mini-Program Growth & UX Optimization"
period: "2022.10 — 2023.01"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["用户调研", "交互设计", "Figma", "数据分析", "竞品分析"]
cover: ""
github: "https://github.com/yanjieZJU"
paper: ""
order: 5
---

## Abstract / 摘要

针对国内首个3D打印鞋品牌小程序销量与转化问题，通过竞品分析（Adidas、匡威等）明确差异化方向，重构信息架构与关键页面（社区模块、商城分类、商品详情），推动用户体验与转化提升。

For China's first 3D-printed shoe brand mini-program, we identified conversion issues through competitive analysis (Adidas, Converse, etc.), then restructured the information architecture and redesigned key pages (community module, product catalog, product detail), driving improvements in UX and conversion.

## System Overview

<!-- Add before/after screenshots here -->

Redesign scope: community module → product catalog → product detail page. Research methods: competitive analysis, user interviews, heuristic evaluation.

## Key Results / 核心成果

- 竞品分析覆盖 Adidas、匡威等主流品牌
- 重构信息架构 + 3 个关键页面重设计
- 社区模块、商城分类、商品详情全面优化

## Implementation Details

- **Research:** Competitive analysis + user interviews (n=12)
- **Design tool:** Figma
- **Deliverables:** Redesigned IA, hi-fi prototypes for 3 key pages
- **Analytics:** Conversion funnel analysis with SPSS
```

- [ ] **Step 6: Commit**

```bash
git add content/projects/
git commit -m "feat: add project Markdown content files"
```

---

## Task 5: Navbar — Academic Blue style

**Files:**
- Modify: `src/components/Navbar.jsx`
- Modify: `src/components/Navbar.css`

- [ ] **Step 1: Replace `src/components/Navbar.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Navbar.css'

const links = [
  { label: 'About', href: '#top' },
  { label: 'Education', href: '#education' },
  { label: 'Works', href: '#projects' },
  { label: 'Skills', href: '#skills' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <a className="navbar-logo" href="#top">颜婕 · Yanjie</a>
      <ul className="navbar-links">
        {links.map(({ label, href }) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Replace `src/components/Navbar.css`**

```css
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--nav-height);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  background: transparent;
  transition: background 0.3s ease, border-bottom 0.3s ease;
}

.navbar.scrolled {
  background: rgba(250, 250, 250, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
}

.navbar-logo {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: normal;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: 0.5px;
}

.navbar-links {
  display: flex;
  gap: 32px;
  list-style: none;
}

.navbar-links a {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.navbar-links a:hover {
  color: var(--color-accent);
}

@media (max-width: 600px) {
  .navbar { padding: 0 20px; }
  .navbar-links { gap: 16px; }
  .navbar-links a { font-size: 10px; letter-spacing: 1px; }
}
```

- [ ] **Step 3: Check dev server — navbar renders with serif logo and uppercase links**

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.jsx src/components/Navbar.css
git commit -m "style: Academic Blue navbar — serif logo, uppercase links"
```

---

## Task 6: Hero section — bilingual layout from content/profile.js

**Files:**
- Modify: `src/components/Hero.jsx`
- Modify: `src/components/Hero.css`

- [ ] **Step 1: Replace `src/components/Hero.jsx`**

```jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import avatar from '../assets/avatar.svg'
import profile from '../../content/profile.js'
import './Hero.css'

export default function Hero() {
  const ref = useScrollAnimation(0.1)

  return (
    <section className="hero" id="top">
      <div className="hero-inner fade-up" ref={ref}>
        <img className="hero-avatar" src={avatar} alt={profile.nameZh} />
        <div className="hero-bio">
          <div className="hero-name-zh">{profile.nameZh}</div>
          <div className="hero-name-en">{profile.nameEn}</div>
          <div className="hero-affil-zh">{profile.affiliationZh}</div>
          <div className="hero-affil-en">{profile.affiliationEn}</div>
          <p className="hero-desc-zh">{profile.bioZh}</p>
          <p className="hero-desc-en">{profile.bioEn}</p>
          <div className="hero-links">
            {profile.email && (
              <a href={`mailto:${profile.email}`} className="hero-link">{profile.email}</a>
            )}
            {profile.github && (
              <a href={profile.github} className="hero-link" target="_blank" rel="noreferrer">GitHub</a>
            )}
            {profile.scholar && (
              <a href={profile.scholar} className="hero-link" target="_blank" rel="noreferrer">Google Scholar</a>
            )}
            {profile.cv && (
              <a href={profile.cv} className="hero-btn" download>↓ CV</a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Replace `src/components/Hero.css`**

```css
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: var(--color-bg);
  padding: calc(var(--nav-height) + 60px) 40px 80px;
  border-bottom: 1px solid var(--color-border);
}

.hero-inner {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 48px;
}

.hero-avatar {
  flex-shrink: 0;
  width: clamp(140px, 18vw, 200px);
  height: clamp(175px, 22vw, 250px);
  border-radius: var(--radius);
  object-fit: cover;
  border: 1px solid var(--color-border);
}

.hero-bio {
  flex: 1;
}

.hero-name-zh {
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: normal;
  color: var(--color-text);
  line-height: 1.2;
  margin-bottom: 4px;
}

.hero-name-en {
  font-family: var(--font-serif);
  font-size: clamp(18px, 2.5vw, 26px);
  font-weight: normal;
  color: var(--color-text);
  margin-bottom: 12px;
}

.hero-affil-zh,
.hero-affil-en {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--color-accent);
  line-height: 1.6;
}

.hero-affil-en {
  margin-bottom: 16px;
}

.hero-desc-zh,
.hero-desc-en {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.hero-desc-en {
  margin-bottom: 24px;
}

.hero-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.hero-link {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-accent);
  text-decoration: none;
}

.hero-link:hover {
  text-decoration: underline;
}

.hero-btn {
  font-family: var(--font-sans);
  font-size: 12px;
  padding: 5px 14px;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  border-radius: var(--radius);
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.hero-btn:hover {
  background: var(--color-accent);
  color: white;
}

@media (max-width: 700px) {
  .hero-inner {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .hero-links { justify-content: center; }
  .hero-avatar { width: 120px; height: 150px; }
}
```

- [ ] **Step 3: Check dev server — hero shows Chinese name on top, English below, serif italic affiliation**

- [ ] **Step 4: Commit**

```bash
git add src/components/Hero.jsx src/components/Hero.css
git commit -m "feat: bilingual Hero section reading from content/profile.js"
```

---

## Task 7: Education section — bilingual expanded

**Files:**
- Modify: `src/components/Education.jsx`
- Modify: `src/components/Education.css`

- [ ] **Step 1: Replace `src/components/Education.jsx`**

```jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import entries from '../../content/education.js'
import './Education.css'

export default function Education() {
  const ref = useScrollAnimation()

  return (
    <section id="education" className="section-alt">
      <div className="section">
        <h2 className="section-heading fade-up" ref={ref}>Education</h2>
        <div className="edu-list">
          {entries.map((entry, i) => (
            <EduItem key={i} entry={entry} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

function EduItem({ entry, delay }) {
  const ref = useScrollAnimation()

  return (
    <div className="edu-item fade-up" ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      <div className="edu-header">
        <div>
          <div className="edu-school-zh">{entry.schoolZh}</div>
          <div className="edu-school-en">{entry.schoolEn}</div>
        </div>
        <span className="edu-period">{entry.period}</span>
      </div>
      <div className="edu-degree-zh">{entry.degreeZh}</div>
      <div className="edu-degree-en">{entry.degreeEn}</div>
      <div className="edu-desc-zh">{entry.descZh}</div>
      <div className="edu-desc-en">{entry.descEn}</div>
      <div className="edu-tags">
        {entry.awards.map((award) => (
          <span key={award} className="edu-tag">{award}</span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/components/Education.css`**

```css
.edu-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.edu-item {
  padding: 28px 0;
  border-bottom: 1px solid var(--color-border);
}

.edu-item:last-child {
  border-bottom: none;
}

.edu-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.edu-school-zh {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: bold;
  color: var(--color-text);
}

.edu-school-en {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.edu-period {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.edu-degree-zh {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--color-accent);
  margin: 6px 0 2px;
}

.edu-degree-en {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--color-accent);
  margin-bottom: 10px;
}

.edu-desc-zh {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.edu-desc-en {
  font-size: 12px;
  color: #888;
  line-height: 1.7;
  margin-bottom: 10px;
}

.edu-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.edu-tag {
  font-family: var(--font-sans);
  font-size: 11px;
  padding: 3px 8px;
  background: var(--color-award-bg);
  color: var(--color-award-text);
  border-radius: 2px;
}
```

- [ ] **Step 3: Verify in browser — two education entries with ZH school name bold, EN italic below, awards in amber tags**

- [ ] **Step 4: Commit**

```bash
git add src/components/Education.jsx src/components/Education.css
git commit -m "feat: bilingual Education section from content/education.js"
```

---

## Task 8: Skills section — Academic Blue style from content/skills.js

**Files:**
- Modify: `src/components/Skills.jsx`
- Modify: `src/components/Skills.css`

- [ ] **Step 1: Replace `src/components/Skills.jsx`**

```jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import skillGroups from '../../content/skills.js'
import './Skills.css'

export default function Skills() {
  const titleRef = useScrollAnimation()

  return (
    <section id="skills" className="section-alt">
      <div className="section">
        <h2 className="section-heading fade-up" ref={titleRef}>Skills</h2>
        <div className="skills-grid">
          {skillGroups.map((group, i) => (
            <SkillGroup key={group.title} group={group} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SkillGroup({ group, delay }) {
  const ref = useScrollAnimation()

  return (
    <div className="skill-group fade-up" ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      <div className="skill-group-title">{group.title}</div>
      <div className="skill-pills">
        {group.pills.map((pill) => (
          <span key={pill} className="skill-pill">{pill}</span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/components/Skills.css`**

```css
.skills-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 28px;
}

.skill-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skill-group-title {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--color-accent);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 4px;
}

.skill-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-pill {
  font-family: var(--font-sans);
  font-size: 12px;
  padding: 4px 10px;
  background: var(--color-tag-bg);
  color: var(--color-accent);
  border-radius: 2px;
}

@media (max-width: 600px) {
  .skills-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Skills.jsx src/components/Skills.css
git commit -m "feat: Skills section from content/skills.js with Academic Blue style"
```

---

## Task 9: Footer — Academic Blue style

**Files:**
- Modify: `src/components/Footer.jsx`
- Modify: `src/components/Footer.css`

- [ ] **Step 1: Replace `src/components/Footer.jsx`**

```jsx
import profile from '../../content/profile.js'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        © 2026 {profile.nameZh} · {profile.nameEn}
        {profile.github && (
          <>{' · '}<a href={profile.github} target="_blank" rel="noreferrer">GitHub</a></>
        )}
        {profile.email && (
          <>{' · '}<a href={`mailto:${profile.email}`}>{profile.email}</a></>
        )}
      </p>
    </footer>
  )
}
```

- [ ] **Step 2: Replace `src/components/Footer.css`**

```css
.footer {
  background: var(--color-bg-alt);
  border-top: 1px solid var(--color-border);
  padding: 32px 24px;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.footer a {
  color: var(--color-accent);
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.jsx src/components/Footer.css
git commit -m "style: Academic Blue footer reading from content/profile.js"
```

---

## Task 10: Projects list — cards from Markdown glob, link to detail pages

**Files:**
- Modify: `src/components/Projects.jsx`
- Modify: `src/components/Projects.css`

- [ ] **Step 1: Replace `src/components/Projects.jsx`**

```jsx
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import matter from 'gray-matter'
import useScrollAnimation from '../hooks/useScrollAnimation'
import './Projects.css'

const mdFiles = import.meta.glob('../../content/projects/*.md', { query: '?raw', import: 'default', eager: true })

function parseProjects() {
  return Object.entries(mdFiles)
    .map(([path, raw]) => {
      const { data } = matter(raw)
      const slug = path.replace(/.*\/(.+)\.md$/, '$1')
      return { ...data, slug }
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}

export default function Projects() {
  const titleRef = useScrollAnimation()
  const projects = useMemo(parseProjects, [])

  return (
    <section id="projects">
      <div className="section">
        <h2 className="section-heading fade-up" ref={titleRef}>Selected Works</h2>
        <div className="projects-grid">
          {projects.map((project, i) => (
            <ProjectCard key={project.slug} project={project} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectCard({ project, delay }) {
  const ref = useScrollAnimation()

  return (
    <div className="project-card fade-up" ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      <span className="project-period">{project.period}</span>
      <h3 className="project-title-zh">{project.title_zh}</h3>
      <span className="project-role">{project.role_zh} / {project.role_en}</span>
      <div className="project-tags">
        {(project.tags ?? []).map((tag) => (
          <span key={tag} className="project-tag">{tag}</span>
        ))}
      </div>
      <Link className="project-link" to={`/projects/${project.slug}`}>
        View Project →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/components/Projects.css`**

```css
.projects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.project-card {
  background: var(--color-bg);
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  transition: background 0.2s;
}

.project-card:hover {
  background: var(--color-bg-alt);
}

.project-period {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-secondary);
}

.project-title-zh {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: bold;
  color: var(--color-text);
  line-height: 1.4;
}

.project-role {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--color-accent);
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.project-tag {
  font-family: var(--font-sans);
  font-size: 10px;
  padding: 2px 7px;
  background: var(--color-tag-bg);
  color: var(--color-accent);
  border-radius: 2px;
}

.project-link {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-accent);
  text-decoration: none;
  margin-top: auto;
  padding-top: 8px;
}

.project-link:hover {
  text-decoration: underline;
}

@media (max-width: 700px) {
  .projects-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Verify — project cards appear, each card has ZH title, role, tags, "View Project →" link**

- [ ] **Step 4: Commit**

```bash
git add src/components/Projects.jsx src/components/Projects.css
git commit -m "feat: Projects grid from MD glob with links to detail pages"
```

---

## Task 11: ProjectDetail page component

**Files:**
- Create: `src/components/ProjectDetail.jsx`
- Create: `src/components/ProjectDetail.css`

- [ ] **Step 1: Create `src/components/ProjectDetail.jsx`**

```jsx
import { useParams, Link } from 'react-router-dom'
import { useMemo } from 'react'
import matter from 'gray-matter'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './ProjectDetail.css'

const mdFiles = import.meta.glob('../../content/projects/*.md', { query: '?raw', import: 'default', eager: true })

function findProject(slug) {
  for (const [path, raw] of Object.entries(mdFiles)) {
    const fileSlug = path.replace(/.*\/(.+)\.md$/, '$1')
    if (fileSlug === slug) {
      const { data, content } = matter(raw)
      return { ...data, slug: fileSlug, content }
    }
  }
  return null
}

export default function ProjectDetail() {
  const { slug } = useParams()
  const project = useMemo(() => findProject(slug), [slug])

  if (!project) {
    return (
      <div className="proj-not-found">
        <p>Project not found.</p>
        <Link to="/">← Back to home</Link>
      </div>
    )
  }

  return (
    <div className="proj-detail">
      <div className="proj-detail-inner">
        <nav className="proj-breadcrumb">
          <Link to="/#projects">← Works</Link>
          <span>/</span>
          <span>{project.title_en}</span>
        </nav>

        {project.cover && (
          <img className="proj-cover" src={project.cover} alt={project.title_zh} />
        )}

        <h1 className="proj-title-zh">{project.title_zh}</h1>
        <h2 className="proj-title-en">{project.title_en}</h2>

        <div className="proj-meta">
          {project.period && <span>📅 {project.period}</span>}
          {(project.role_zh || project.role_en) && (
            <span>{project.role_zh} / {project.role_en}</span>
          )}
        </div>

        <div className="proj-links">
          {project.github && (
            <a className="proj-link-btn proj-link-primary" href={project.github} target="_blank" rel="noreferrer">
              GitHub →
            </a>
          )}
          {project.paper && (
            <a className="proj-link-btn" href={project.paper} target="_blank" rel="noreferrer">
              Paper →
            </a>
          )}
        </div>

        {project.tags && (
          <div className="proj-tags">
            {project.tags.map((tag) => (
              <span key={tag} className="proj-tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="proj-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {project.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/ProjectDetail.css`**

```css
.proj-detail {
  min-height: 100vh;
  background: var(--color-bg);
  padding: calc(var(--nav-height) + 48px) 24px 80px;
}

.proj-detail-inner {
  max-width: 780px;
  margin: 0 auto;
}

.proj-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 32px;
}

.proj-breadcrumb a {
  color: var(--color-accent);
  text-decoration: none;
}

.proj-breadcrumb a:hover {
  text-decoration: underline;
}

.proj-breadcrumb span:last-child {
  color: var(--color-text-secondary);
}

.proj-cover {
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  margin-bottom: 28px;
}

.proj-title-zh {
  font-family: var(--font-serif);
  font-size: clamp(22px, 3vw, 32px);
  font-weight: normal;
  color: var(--color-text);
  line-height: 1.3;
  margin-bottom: 6px;
}

.proj-title-en {
  font-family: var(--font-serif);
  font-size: clamp(14px, 2vw, 18px);
  font-weight: normal;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.proj-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.proj-links {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.proj-link-btn {
  font-family: var(--font-sans);
  font-size: 12px;
  padding: 5px 14px;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  border-radius: var(--radius);
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.proj-link-btn:hover {
  background: var(--color-accent);
  color: white;
}

.proj-link-primary {
  background: var(--color-accent);
  color: white;
}

.proj-link-primary:hover {
  opacity: 0.85;
}

.proj-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.proj-tag {
  font-family: var(--font-sans);
  font-size: 11px;
  padding: 3px 8px;
  background: var(--color-tag-bg);
  color: var(--color-accent);
  border-radius: 2px;
}

/* Markdown body typography */
.proj-body {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.9;
  color: var(--color-text);
}

.proj-body h2 {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
  padding-bottom: 6px;
  margin: 36px 0 16px;
}

.proj-body h3 {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: bold;
  color: var(--color-text);
  margin: 24px 0 8px;
}

.proj-body p {
  margin-bottom: 16px;
  color: var(--color-text-secondary);
}

.proj-body ul,
.proj-body ol {
  padding-left: 24px;
  margin-bottom: 16px;
}

.proj-body li {
  margin-bottom: 6px;
  color: var(--color-text-secondary);
}

.proj-body img {
  max-width: 100%;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  margin: 16px 0;
}

.proj-body strong {
  color: var(--color-text);
  font-weight: bold;
}

.proj-body code {
  font-family: var(--font-sans);
  font-size: 12px;
  background: var(--color-tag-bg);
  color: var(--color-accent);
  padding: 1px 5px;
  border-radius: 2px;
}

.proj-not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  font-family: var(--font-serif);
}

.proj-not-found a {
  color: var(--color-accent);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ProjectDetail.jsx src/components/ProjectDetail.css
git commit -m "feat: ProjectDetail page with Markdown body, breadcrumb, GitHub/paper links"
```

---

## Task 12: Wire up routing in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace `src/App.jsx`**

```jsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Education from './components/Education'
import Projects from './components/Projects'
import Skills from './components/Skills'
import Footer from './components/Footer'
import ProjectDetail from './components/ProjectDetail'
import './App.css'

function HomePage() {
  return (
    <>
      <Hero />
      <Education />
      <Projects />
      <Skills />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
        </Routes>
      </main>
      <Footer />
    </HashRouter>
  )
}
```

- [ ] **Step 2: Verify end-to-end in browser**

1. Open `http://localhost:5173` — home page loads with all sections
2. Click "View Project →" on a project card — navigates to `/projects/ergokare` (hash URL: `#/projects/ergokare`)
3. Markdown body renders with sections
4. Breadcrumb "← Works" navigates back to home `#projects` anchor
5. GitHub button links to correct repo

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire up HashRouter with home and project detail routes"
```

---

## Task 13: Final check and build

**Files:** none (verification only)

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: no errors, `dist/` folder created.

- [ ] **Step 2: Preview production build**

```bash
npm run preview
```

Open `http://localhost:4173`. Test:
- Home page loads correctly
- All sections visible (Hero, Education, Projects, Skills, Footer)
- Click a project card → detail page loads
- Breadcrumb back → returns to home

- [ ] **Step 3: Check for console errors**

Open browser DevTools. Confirm no errors in console.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final build verification — Academic Blue redesign complete"
```

---

## Self-Review

**Spec coverage check:**
- [x] §1 Visual Style: Academic Blue tokens in Task 2
- [x] §2 Hero bilingual: Task 6, reading from `content/profile.js`
- [x] §3 Education bilingual + expanded: Task 7, `content/education.js`
- [x] §4a Projects list from MD frontmatter: Task 10
- [x] §4b Project detail page with React Router: Tasks 11+12
- [x] §4c Frontmatter schema: Task 4 (all 5 .md files)
- [x] §5 Content directory structure: Tasks 3+4
- [x] §6 New deps (react-router-dom, gray-matter, react-markdown, remark-gfm): Task 1
- [x] §7 All files listed: covered across tasks
- [x] §8 HashRouter for gh-pages: Task 12; `.superpowers/` in .gitignore: Task 1

**No placeholders found.**

**Type consistency:**
- `profile.nameZh/nameEn/affiliationZh/affiliationEn/bioZh/bioEn/email/github/scholar/cv` — consistent across Hero, Footer
- `education.js` fields `schoolZh/schoolEn/degreeZh/degreeEn/period/descZh/descEn/awards` — consistent in Education.jsx
- MD frontmatter `title_zh/title_en/period/role_zh/role_en/tags/cover/github/paper/order/slug` — consistent in Projects.jsx and ProjectDetail.jsx
- `import.meta.glob` pattern `../../content/projects/*.md` — identical in both Projects.jsx and ProjectDetail.jsx ✓
