# Personal Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild 颜婕's personal homepage as a React + Vite single-page app with Apple-inspired minimal design, populated with resume content.

**Architecture:** Vite scaffolds a React SPA; each page section is an isolated component; CSS variables drive the purple-blue gradient theme; IntersectionObserver powers scroll-triggered fade-up animations. Build output goes to `dist/` for GitHub Pages deployment.

**Tech Stack:** React 18, Vite 5, plain CSS (no UI library), gh-pages for deployment.

---

## File Map

| Path | Role |
|---|---|
| `package.json` | Vite + React deps, build/deploy scripts |
| `vite.config.js` | Base path set to `/` for GitHub Pages |
| `index.html` | Vite entry point (replaces current file) |
| `src/main.jsx` | React mount |
| `src/App.jsx` | Root component, assembles all sections |
| `src/index.css` | CSS variables, reset, global animation classes |
| `src/App.css` | Layout helpers shared across components |
| `src/assets/avatar.jpg` | Placeholder avatar extracted from resume PDF |
| `src/components/Navbar.jsx` + `Navbar.css` | Fixed top nav with scroll-triggered glass effect |
| `src/components/Hero.jsx` + `Hero.css` | Left-text / right-avatar hero section |
| `src/components/Education.jsx` + `Education.css` | Vertical timeline, two entries |
| `src/components/Projects.jsx` + `Projects.css` | 2×2 card grid, hover lift |
| `src/components/Skills.jsx` + `Skills.css` | Pill tags grouped by category |
| `src/components/Footer.jsx` + `Footer.css` | Simple centered footer |
| `src/hooks/useScrollAnimation.js` | Shared IntersectionObserver hook |

---

## Task 1: Scaffold Vite + React project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/App.css`
- Create: `src/index.css`

- [ ] **Step 1: Initialize Vite project in-place**

Run from `D:\研究生\yanjieZJU.github.io`:
```bash
npm create vite@latest . -- --template react
```
When prompted "Current directory is not empty. Remove existing files and continue?" — choose **No, keep files** (or type `n`). Vite will place `package.json`, `vite.config.js`, `index.html`, and `src/` alongside the existing `index.html`. If Vite refuses due to conflict, manually create the files in steps below.

> **If the interactive prompt is a problem**, skip this step and proceed to Step 2 which creates each file manually.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "yanjie-personal-site",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
})
```

- [ ] **Step 4: Replace `index.html` with Vite entry**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>颜婕 - 个人主页</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Create `src/index.css`** (global variables and reset)

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-bg: #ffffff;
  --color-bg-alt: #f5f5f7;
  --color-text: #1d1d1f;
  --color-text-secondary: #6e6e73;
  --color-accent-start: #667eea;
  --color-accent-end: #a78bfa;
  --gradient: linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end));
  --gradient-bg: linear-gradient(135deg, #f0f4ff 0%, #ffffff 50%, #f5f0ff 100%);
  --font: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  --radius: 16px;
  --shadow: 0 4px 24px rgba(102, 126, 234, 0.12);
  --shadow-hover: 0 12px 40px rgba(102, 126, 234, 0.22);
  --nav-height: 56px;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Scroll animation base states */
.fade-up {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 7: Create `src/App.css`**

```css
.section {
  padding: 96px 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.section-alt {
  background: var(--color-bg-alt);
}

.section-alt .section {
  /* inner container inside alt-bg wrapper */
}

.section-title {
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 48px;
  background: var(--gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

- [ ] **Step 8: Create placeholder `src/App.jsx`**

```jsx
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Education from './components/Education'
import Projects from './components/Projects'
import Skills from './components/Skills'
import Footer from './components/Footer'
import './App.css'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <div className="section-alt">
          <Education />
        </div>
        <Projects />
        <div className="section-alt">
          <Skills />
        </div>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 9: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 10: Create `src/assets/` directory and add avatar placeholder**

Extract the avatar from the resume PDF. If extraction tools aren't available, create a simple SVG placeholder:

Save as `src/assets/avatar.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260" viewBox="0 0 200 260">
  <rect width="200" height="260" rx="16" fill="#e8e8f0"/>
  <circle cx="100" cy="95" r="45" fill="#c0c0d0"/>
  <ellipse cx="100" cy="220" rx="70" ry="55" fill="#c0c0d0"/>
</svg>
```

- [ ] **Step 11: Commit scaffold**

```bash
git add package.json vite.config.js index.html src/ -f
git commit -m "feat: scaffold Vite + React project structure"
```

---

## Task 2: useScrollAnimation hook

**Files:**
- Create: `src/hooks/useScrollAnimation.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useScrollAnimation.js
import { useEffect, useRef } from 'react'

/**
 * Attaches an IntersectionObserver to the returned ref.
 * When the element enters the viewport, adds class 'visible'
 * (works with the .fade-up CSS in index.css).
 *
 * @param {number} threshold - 0–1, fraction of element visible before triggering
 * @returns {React.RefObject}
 */
export default function useScrollAnimation(threshold = 0.15) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible')
          observer.unobserve(el)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return ref
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useScrollAnimation.js
git commit -m "feat: add useScrollAnimation hook"
```

---

## Task 3: Navbar component

**Files:**
- Create: `src/components/Navbar.jsx`
- Create: `src/components/Navbar.css`

- [ ] **Step 1: Create `Navbar.css`**

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
  padding: 0 32px;
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.navbar.scrolled {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
}

.navbar-logo {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.3px;
  background: var(--gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-decoration: none;
}

.navbar-links {
  display: flex;
  gap: 28px;
  list-style: none;
}

.navbar-links a {
  font-size: 14px;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.navbar-links a:hover {
  color: var(--color-accent-start);
}

@media (max-width: 600px) {
  .navbar-links {
    gap: 16px;
  }

  .navbar-links a {
    font-size: 12px;
  }
}
```

- [ ] **Step 2: Create `Navbar.jsx`**

```jsx
// src/components/Navbar.jsx
import { useEffect, useState } from 'react'
import './Navbar.css'

const links = [
  { label: '教育经历', href: '#education' },
  { label: '项目经历', href: '#projects' },
  { label: '个人技能', href: '#skills' },
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
      <a className="navbar-logo" href="#top">颜婕</a>
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

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.jsx src/components/Navbar.css
git commit -m "feat: add fixed Navbar with scroll glass effect"
```

---

## Task 4: Hero component

**Files:**
- Create: `src/components/Hero.jsx`
- Create: `src/components/Hero.css`

- [ ] **Step 1: Create `Hero.css`**

```css
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: var(--gradient-bg);
  padding: calc(var(--nav-height) + 48px) 24px 80px;
}

.hero-inner {
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 48px;
}

.hero-text {
  flex: 1;
}

.hero-label {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--color-accent-start);
  margin-bottom: 16px;
}

.hero-name {
  font-size: clamp(48px, 8vw, 80px);
  font-weight: 800;
  letter-spacing: -2px;
  line-height: 1.05;
  background: var(--gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 20px;
}

.hero-subtitle {
  font-size: clamp(18px, 3vw, 24px);
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
}

.hero-meta {
  font-size: 15px;
  color: var(--color-text-secondary);
  margin-bottom: 36px;
}

.hero-links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 28px;
  border-radius: 980px;
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.2s;
}

.hero-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.hero-btn-primary {
  background: var(--gradient);
  color: #fff;
}

.hero-btn-secondary {
  background: rgba(102, 126, 234, 0.1);
  color: var(--color-accent-start);
}

.hero-avatar {
  flex-shrink: 0;
  width: clamp(180px, 22vw, 240px);
  height: clamp(220px, 28vw, 300px);
  border-radius: 20px;
  object-fit: cover;
  box-shadow: var(--shadow-hover);
  border: 3px solid rgba(255, 255, 255, 0.8);
}

@media (max-width: 700px) {
  .hero-inner {
    flex-direction: column-reverse;
    text-align: center;
  }

  .hero-links {
    justify-content: center;
  }

  .hero-avatar {
    width: 140px;
    height: 175px;
  }
}
```

- [ ] **Step 2: Create `Hero.jsx`**

```jsx
// src/components/Hero.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import avatar from '../assets/avatar.svg'
import './Hero.css'

export default function Hero() {
  const ref = useScrollAnimation(0.1)

  return (
    <section className="hero" id="top">
      <div className="hero-inner fade-up" ref={ref}>
        <div className="hero-text">
          <p className="hero-label">人与 AI 交互设计研究者</p>
          <h1 className="hero-name">颜婕</h1>
          <p className="hero-subtitle">浙江大学 · 设计学 硕士（保研）</p>
          <p className="hero-meta">研究方向：人与AI交互，关注大模型在设计支持、体验评估与智能交互中的应用</p>
          <div className="hero-links">
            <a
              className="hero-btn hero-btn-primary"
              href="mailto:yanjie02@zju.edu.cn"
            >
              ✉ 联系我
            </a>
            <a
              className="hero-btn hero-btn-secondary"
              href="https://github.com/yanjieZJU"
              target="_blank"
              rel="noreferrer"
            >
              GitHub →
            </a>
          </div>
        </div>
        <img
          className="hero-avatar"
          src={avatar}
          alt="颜婕头像"
        />
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Hero.jsx src/components/Hero.css
git commit -m "feat: add Hero section with avatar and gradient text"
```

---

## Task 5: Education component

**Files:**
- Create: `src/components/Education.jsx`
- Create: `src/components/Education.css`

- [ ] **Step 1: Create `Education.css`**

```css
.education-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 28px;
}

.education-timeline::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--gradient);
  border-radius: 2px;
}

.edu-item {
  position: relative;
  padding: 0 0 48px 32px;
}

.edu-item::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--gradient);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.edu-item:last-child {
  padding-bottom: 0;
}

.edu-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.edu-school {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.edu-period {
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.edu-degree {
  font-size: 15px;
  color: var(--color-accent-start);
  font-weight: 500;
  margin-bottom: 8px;
}

.edu-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.edu-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.edu-tag {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 980px;
  background: rgba(102, 126, 234, 0.1);
  color: var(--color-accent-start);
}
```

- [ ] **Step 2: Create `Education.jsx`**

```jsx
// src/components/Education.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import '../App.css'
import './Education.css'

const entries = [
  {
    school: '浙江大学 计算机科学与技术学院',
    degree: '设计学 · 硕士（保研）',
    period: '2024.09 — 至今',
    desc: '研究方向：人与AI交互，关注大模型在设计支持、体验评估与智能交互中的应用',
    tags: ['优秀研究生', '五好研究生'],
  },
  {
    school: '浙江大学 计算机科学与技术学院',
    degree: '工业设计 · 本科（GPA 4.48/5.00，top 15%）',
    period: '2020.09 — 2024.06',
    desc: '主修课程：信息交互设计技术、用户体验与产品创新设计、数据结构基础、设计心理学',
    tags: ['浙江省政府奖学金 ×2', '校级二等奖学金', '校级优秀毕业生', '浙江省第十三届挑战杯金奖'],
  },
]

export default function Education() {
  const ref = useScrollAnimation()

  return (
    <section id="education" style={{ padding: '96px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 className="section-title fade-up" ref={ref}>教育经历</h2>
        <div className="education-timeline">
          {entries.map((entry, i) => (
            <EduItem key={i} entry={entry} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  )
}

function EduItem({ entry, delay }) {
  const ref = useScrollAnimation()

  return (
    <div
      className="edu-item fade-up"
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="edu-header">
        <span className="edu-school">{entry.school}</span>
        <span className="edu-period">{entry.period}</span>
      </div>
      <div className="edu-degree">{entry.degree}</div>
      <div className="edu-desc">{entry.desc}</div>
      <div className="edu-tags">
        {entry.tags.map((tag) => (
          <span key={tag} className="edu-tag">{tag}</span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Education.jsx src/components/Education.css
git commit -m "feat: add Education timeline section"
```

---

## Task 6: Projects component

**Files:**
- Create: `src/components/Projects.jsx`
- Create: `src/components/Projects.css`

- [ ] **Step 1: Create `Projects.css`**

```css
.projects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.project-card {
  background: var(--color-bg);
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: var(--radius);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: default;
}

.project-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-hover);
}

.project-period {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--color-accent-start);
}

.project-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.3;
}

.project-role {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 980px;
  background: var(--gradient);
  color: #fff;
  display: inline-block;
  width: fit-content;
}

.project-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  flex: 1;
  line-height: 1.7;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.project-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 980px;
  background: rgba(102, 126, 234, 0.1);
  color: var(--color-accent-start);
}

.project-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent-start);
  text-decoration: none;
  transition: gap 0.2s;
  width: fit-content;
}

.project-link:hover {
  gap: 8px;
}

@media (max-width: 700px) {
  .projects-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create `Projects.jsx`**

```jsx
// src/components/Projects.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import '../App.css'
import './Projects.css'

const projects = [
  {
    period: '2024.10 — 2025.11',
    title: '基于LLM的人体工效学风险预筛助手',
    role: '项目负责人',
    desc: '针对工业场景工效学评估高度依赖人工分析的问题，以知识增强LLM辅助系统替代人工筛查，构建297条高频干预方案知识库，基准准确率提升8.7%，建议有效性提升16.1%，70.8%方案获领域专家偏好。',
    tags: ['LLM', 'RAG', 'GPT-4o', 'Prompt工程', '工效学'],
    link: 'https://github.com/yanjieZJU/ErgoKARE',
    linkLabel: '查看 GitHub →',
  },
  {
    period: '2023.06 — 2023.09',
    title: '基于LLM的说服式语音驾驶助手',
    role: '项目核心成员 · IEEE SMC 2025',
    desc: '面向L3自动驾驶场景的说服式语音驾驶助手，设计六类说话策略与LLM语言生成方案，在模拟驾驶实验中显著降低用户认知负荷，有用性提升11.7%，易用性提升30.4%，行为意愿提升5.4%。',
    tags: ['LLM', 'Prompt工程', 'HCI', 'IEEE SMC 2025', '自动驾驶'],
    link: 'https://github.com/yanjieZJU',
    linkLabel: 'GitHub →',
  },
  {
    period: '2024.10 — 2025.12',
    title: 'HCI领域大语言模型构建',
    role: '项目核心成员',
    desc: '面向HCI设计任务的垂类模型微调，将12,743篇HCI论文转化为双级指令微调数据集（Task-to-Requirement + Requirement-to-Concept），研究对比SFT、LoRA、DPO等方案，基于LLaMA-Factory完成完整微调链路。',
    tags: ['SFT', 'LoRA', 'DPO', 'LLaMA-Factory', 'Llama-3', 'Qwen2.5'],
    link: 'https://github.com/yanjieZJU',
    linkLabel: 'GitHub →',
  },
  {
    period: '2022.10 — 2023.01',
    title: '星世线小程序增长与体验优化',
    role: '项目负责人',
    desc: '针对国内首个3D打印鞋品牌小程序销量与转化问题，通过竞品分析（Adidas、匡威等）明确差异化方向，重构信息架构与关键页面（社区模块、商城分类、商品详情），推动用户体验与转化提升。',
    tags: ['用户调研', '交互设计', 'Figma', '数据分析', '竞品分析'],
    link: 'https://github.com/yanjieZJU',
    linkLabel: 'GitHub →',
  },
]

export default function Projects() {
  const titleRef = useScrollAnimation()

  return (
    <section id="projects" style={{ padding: '96px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 className="section-title fade-up" ref={titleRef}>项目经历</h2>
        <div className="projects-grid">
          {projects.map((project, i) => (
            <ProjectCard key={i} project={project} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectCard({ project, delay }) {
  const ref = useScrollAnimation()

  return (
    <div
      className="project-card fade-up"
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="project-period">{project.period}</span>
      <h3 className="project-title">{project.title}</h3>
      <span className="project-role">{project.role}</span>
      <p className="project-desc">{project.desc}</p>
      <div className="project-tags">
        {project.tags.map((tag) => (
          <span key={tag} className="project-tag">{tag}</span>
        ))}
      </div>
      <a
        className="project-link"
        href={project.link}
        target="_blank"
        rel="noreferrer"
      >
        {project.linkLabel}
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Projects.jsx src/components/Projects.css
git commit -m "feat: add Projects card grid section"
```

---

## Task 7: Skills component

**Files:**
- Create: `src/components/Skills.jsx`
- Create: `src/components/Skills.css`

- [ ] **Step 1: Create `Skills.css`**

```css
.skills-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}

.skill-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skill-group-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--color-accent-start);
}

.skill-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-pill {
  font-size: 13px;
  padding: 6px 16px;
  border-radius: 980px;
  background: rgba(102, 126, 234, 0.08);
  color: var(--color-text);
  border: 1px solid rgba(102, 126, 234, 0.2);
  transition: background 0.2s, border-color 0.2s;
}

.skill-pill:hover {
  background: rgba(102, 126, 234, 0.15);
  border-color: rgba(102, 126, 234, 0.4);
}

@media (max-width: 600px) {
  .skills-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create `Skills.jsx`**

```jsx
// src/components/Skills.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import '../App.css'
import './Skills.css'

const skillGroups = [
  {
    title: '语言能力',
    pills: ['英语 CET-6（615）'],
  },
  {
    title: '产品技能',
    pills: ['用户调研', '需求分析', '交互原型设计', 'Figma', '数据分析（SPSS）'],
  },
  {
    title: 'AI 产品能力',
    pills: ['Prompt 设计', 'RAG', '指令微调', 'AI Agent 编排（Coze）', 'AIGC 工具（ComfyUI）'],
  },
  {
    title: '开发协作',
    pills: ['AI 编程工具（Antigravity）', 'TRAE'],
  },
]

export default function Skills() {
  const titleRef = useScrollAnimation()

  return (
    <section id="skills" style={{ padding: '96px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 className="section-title fade-up" ref={titleRef}>个人技能</h2>
        <div className="skills-grid">
          {skillGroups.map((group, i) => (
            <SkillGroup key={group.title} group={group} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SkillGroup({ group, delay }) {
  const ref = useScrollAnimation()

  return (
    <div
      className="skill-group fade-up"
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
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

- [ ] **Step 3: Commit**

```bash
git add src/components/Skills.jsx src/components/Skills.css
git commit -m "feat: add Skills section with grouped pill tags"
```

---

## Task 8: Footer component

**Files:**
- Create: `src/components/Footer.jsx`
- Create: `src/components/Footer.css`

- [ ] **Step 1: Create `Footer.css`**

```css
.footer {
  background: var(--color-bg-alt);
  border-top: 1px solid rgba(102, 126, 234, 0.1);
  padding: 40px 24px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.footer a {
  color: var(--color-accent-start);
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}
```

- [ ] **Step 2: Create `Footer.jsx`**

```jsx
// src/components/Footer.jsx
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        © 2026 Yanjie ·
        <a href="https://github.com/yanjieZJU" target="_blank" rel="noreferrer"> GitHub</a>
        {' · '}
        <a href="mailto:yanjie02@zju.edu.cn">yanjie02@zju.edu.cn</a>
      </p>
    </footer>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.jsx src/components/Footer.css
git commit -m "feat: add Footer component"
```

---

## Task 9: Dev smoke test

**Files:** None new — verifies everything wires together.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected output includes a local URL like `http://localhost:5173`. Open it in the browser.

- [ ] **Step 2: Verify checklist in browser**

Check each item visually:
- [ ] Navbar visible and fixed at top
- [ ] Scrolling past 50px makes navbar background go frosted glass
- [ ] Hero shows name, subtitle, avatar placeholder, two buttons
- [ ] Scrolling triggers fade-up animations on each section
- [ ] Education timeline shows two entries with tags
- [ ] Projects shows 4 cards in 2×2 grid; hover lifts card
- [ ] Skills shows 4 groups with pill tags
- [ ] Footer shows copyright + links
- [ ] Mobile: resize to 375px width — layout stacks to single column

- [ ] **Step 3: Fix any visual issues found**, then commit

```bash
git add -A
git commit -m "fix: smoke test visual corrections"
```

---

## Task 10: Build and deploy to GitHub Pages

**Files:**
- Modify: `vite.config.js` (set base if repo is not at root)
- Modify: `package.json` (add deploy script)

- [ ] **Step 1: Check GitHub Pages config**

The repo is `yanjieZJU.github.io` — this is a user/org pages repo, served at the root (`https://yanjieZJU.github.io/`). No base path change needed; `base: '/'` in `vite.config.js` is correct.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: `dist/` directory created with `index.html` and `assets/`.

- [ ] **Step 3: Configure GitHub Pages to serve from `dist/`**

Option A (simplest — copy dist to root and commit):
```bash
cp -r dist/* .
git add index.html assets/
git commit -m "build: deploy static site to root for GitHub Pages"
git push origin main
```

Option B (use gh-pages package — cleaner):
```bash
npm install --save-dev gh-pages
```

Add to `package.json` scripts:
```json
"deploy": "gh-pages -d dist"
```

Then:
```bash
npm run build && npm run deploy
```

**Recommended: Option B** — keeps build artifacts off main branch.

- [ ] **Step 4: Verify live site**

Open `https://yanjieZJU.github.io` in browser (may take 1–2 minutes for GitHub Pages to propagate). Confirm all sections render correctly.

- [ ] **Step 5: Commit deploy setup**

```bash
git add package.json
git commit -m "chore: add gh-pages deploy script"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Vite + React framework
- ✅ Fixed navbar with glass effect on scroll
- ✅ Hero: left text + right avatar (placeholder from resume)
- ✅ Education timeline (硕士 + 本科, with honors)
- ✅ Projects: 4 cards with GitHub links, tags, descriptions
- ✅ Skills: grouped pill tags (语言/产品/AI/开发)
- ✅ Apple-style gradient design, CSS variables
- ✅ IntersectionObserver scroll animations
- ✅ Hover animations on project cards
- ✅ Mobile responsive (single column)
- ✅ GitHub Pages deployment

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:** `useScrollAnimation` returns `ref`, applied as `ref={ref}` consistently across all components. CSS class names (`fade-up`, `visible`) match between `index.css` and component usage. Component filenames match import paths.
