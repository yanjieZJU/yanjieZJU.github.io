# Website Redesign Spec — 2026-04-03

## Overview

Redesign yanjieZJU.github.io from a gradient-heavy modern style to an Academic Blue serif aesthetic, introduce a `content/` directory for all editable data, and add per-project detail pages with Markdown-driven rich content.

---

## 1. Visual Style

**Theme: Academic Blue**

| Token | Value |
|---|---|
| Background | `#fafafa` |
| Text | `#1a1a1a` |
| Accent | `#2c4a7c` |
| Border | `#dde3ee` |
| Alt background | `#eef2f9` |
| Font (body/headings) | `Georgia, serif` |
| Font (meta/tags/UI) | `-apple-system, sans-serif` |

- Section headings: `9px`, `letter-spacing: 3px`, `text-transform: uppercase`, underlined with `1px solid #2c4a7c`
- Navbar: thin horizontal rule, nav links `uppercase` `letter-spacing: 2px`
- Buttons: `border: 1px solid #2c4a7c` (outline) or `background: #2c4a7c; color: white` (filled)
- Award/honor tags: `background: #fef9ec; color: #92400e`
- Tech tags: `background: #eef2f9; color: #2c4a7c`

Remove: all purple/violet gradients, `--gradient`, `--gradient-bg`, `box-shadow` on hero avatar.

---

## 2. Hero Section (Bilingual)

Layout: photo left, bio right (existing layout preserved).

Bio column stacking order:
1. Chinese name (`颜婕`) — serif, 18px
2. English name (`Yanjie`) — serif, 14px, color `#1a1a1a`
3. Chinese affiliation (`浙江大学计算机科学与技术学院 · 设计学 硕士`) — italic, 11px, accent color
4. English affiliation (`Zhejiang University · M.S. in Design`) — italic, 11px, accent color
5. Chinese bio paragraph
6. English bio paragraph
7. Links row: Email · GitHub · Google Scholar · [↓ CV] button

Data source: `content/profile.js`

---

## 3. Education Section (Bilingual, Expanded)

Each entry renders:
- School name ZH + EN (italic, smaller)
- Degree ZH + EN on same line, period right-aligned
- Description: courses ZH + EN (two lines)
- Award tags (amber style) + honor tags (blue style)

Data source: `content/education.js`

Current entries:

**浙江大学 / Zhejiang University** · M.S. Design · 2024.09–2027.06
- Research: Human-AI Interaction, LLM in design support & intelligent interaction
- Awards: 优秀研究生, 五好研究生

**浙江大学 / Zhejiang University** · B.Eng. Industrial Design · 2020.09–2024.06
- GPA 4.48/5.00, Top 15%
- Courses: 信息交互设计技术、用户体验与产品创新设计、数据结构基础、设计心理学 / Information Interaction Design, UX & Product Innovation, Data Structures, Design Psychology
- Awards: 浙江省政府奖学金 ×2, 校级二等奖学金, 校级优秀毕业生, 浙江省第十三届挑战杯金奖

---

## 4. Projects — List + Detail Pages

### 4a. Projects List (index)

Grid of cards on main page. Each card shows:
- Period, title ZH, role (italic), short desc, tags, "→ View Project" link

Data source: frontmatter parsed from `content/projects/*.md`

### 4b. Project Detail — Independent Page (`/projects/:slug`)

Uses **React Router v6**. Route: `<Route path="/projects/:slug" element={<ProjectDetail />} />`

Page layout:
1. Breadcrumb: `← Works / <title_en>`
2. Cover image (`cover` field, optional — shows placeholder if absent)
3. Title ZH (large serif)
4. Title EN (smaller serif, muted)
5. Meta row: period, role ZH/EN
6. Link buttons: GitHub (always shown), Paper (shown only if `paper` field non-empty)
7. Tags row
8. Markdown body rendered with `react-markdown` + `remark-gfm`

Markdown body sections (by convention, not enforced):
- `## Abstract / 摘要`
- `## System Overview` (place architecture images here)
- `## Key Results / 核心成果`
- `## Implementation Details`

### 4c. Frontmatter Schema

```yaml
title_zh:  "基于LLM的人体工效学风险预筛助手"
title_en:  "ErgoKARE: LLM-Powered Ergonomic Risk Screening"
period:    "2024.10 — 2025.11"
role_zh:   "项目负责人"
role_en:   "Project Lead"
tags:      ["LLM", "RAG", "GPT-4o", "Prompt Engineering", "工效学"]
cover:     "/images/ergokare-cover.jpg"   # optional
github:    "https://github.com/yanjieZJU/ErgoKARE"
paper:     ""          # empty = button not shown
order:     1           # ascending sort on list page
```

---

## 5. Content Directory Structure

```
content/
├── profile.js        ← personal info: name, bio ZH/EN, links, cv path
├── education.js      ← array of education entries
├── skills.js         ← array of skill groups
└── projects/
    ├── ergokare.md
    ├── diamaid.md
    ├── driving-assistant.md
    ├── hci-llm.md
    └── xingshixian.md
```

`profile.js`, `education.js`, `skills.js` are plain ES modules (`export default [...]`), imported directly by components — no fetch, no build plugin needed.

`projects/*.md` are imported using Vite's `import.meta.glob('../../content/projects/*.md', { as: 'raw' })`, then parsed with `gray-matter` at runtime.

---

## 6. New Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react-router-dom` | v6 | Client-side routing for project detail pages |
| `gray-matter` | latest | Parse frontmatter from .md strings |
| `react-markdown` | latest | Render Markdown body in detail page |
| `remark-gfm` | latest | GFM support (tables, task lists) in react-markdown |

Vite `?raw` imports require no additional plugin (built-in). Use `import.meta.glob` with `{ query: '?raw', import: 'default' }`.

---

## 7. Files to Change

| File | Action |
|---|---|
| `src/index.css` | Replace color tokens, font stack |
| `src/App.css` | Update `.section-title` style |
| `src/App.jsx` | Wrap with `BrowserRouter`, add `/projects/:slug` route |
| `src/components/Navbar.jsx` + `.css` | Academic Blue style, add EN labels |
| `src/components/Hero.jsx` + `.css` | Bilingual layout, read from `content/profile.js` |
| `src/components/Education.jsx` + `.css` | Bilingual expanded, read from `content/education.js` |
| `src/components/Projects.jsx` + `.css` | Card grid + router links, data from glob |
| `src/components/Skills.jsx` + `.css` | Style update, read from `content/skills.js` |
| `src/components/Footer.jsx` + `.css` | Style update |
| `src/components/ProjectDetail.jsx` | **New** — detail page component |
| `src/components/ProjectDetail.css` | **New** |
| `content/profile.js` | **New** |
| `content/education.js` | **New** |
| `content/skills.js` | **New** |
| `content/projects/ergokare.md` | **New** |
| `content/projects/diamaid.md` | **New** |
| `content/projects/driving-assistant.md` | **New** |
| `content/projects/hci-llm.md` | **New** |
| `content/projects/xingshixian.md` | **New** |
| `index.html` | Already correct (Vite entry) |
| `vite.config.js` | May need `base` update for gh-pages if using React Router |

---

## 8. Decisions & Constraints

- No SSG/SSR — stays client-side Vite + React SPA
- GitHub Pages deploy: needs `vite.config.js` `base: './'` OR hash router if 404 on refresh is a concern. Use `HashRouter` to avoid gh-pages 404 issue with React Router.
- Images stored in `public/images/` so they're served at `/images/...`
- `.superpowers/` should be in `.gitignore`
