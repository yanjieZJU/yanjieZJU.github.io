# Xingshixian Prototype Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `PrototypeShowcase` React component to `xingshixian-charts.jsx` that lets visitors toggle between original/redesigned mini-program screens, switch between pages, and scroll through full-length screens where available.

**Architecture:** A single self-contained component appended to the existing `content/projects/xingshixian-charts.jsx`. It uses the site's existing `<chart id="PrototypeShowcase" />` render mechanism — no framework changes needed. All styles are inline. State: `mode` (before/after), `activePage`, `lightboxOpen`.

**Tech Stack:** React 18, inline styles only, no external libraries

---

## File Map

| File | Action | What changes |
|---|---|---|
| `content/projects/xingshixian-charts.jsx` | Modify | Append `PrototypeShowcase` export at end of file |
| `content/projects/xingshixian.md` | Modify | Add `<chart id="PrototypeShowcase" />` in `## Prototype Demo` section |

---

## Page Data Reference

```js
// origin_details_long.png exists — so both home AND details have long versions for both modes
const PAGES = [
  {
    id: 'home',
    label: '首页',
    before: { src: '/xingshixian/origin_home.png',          scrollable: false },
    after:  { src: '/xingshixian/updated_home_long.png',    scrollable: true  },
  },
  {
    id: 'list',
    label: '列表',
    before: null,
    after:  { src: '/xingshixian/updated_list.png',         scrollable: false },
  },
  {
    id: 'purchase',
    label: '购买',
    before: { src: '/xingshixian/origin_purchase.png',      scrollable: false },
    after:  { src: '/xingshixian/updated_purchase.png',     scrollable: false },
  },
  {
    id: 'community',
    label: '社区',
    before: null,
    after:  { src: '/xingshixian/updated_community.png',    scrollable: false },
  },
  {
    id: 'details',
    label: '详情',
    before: { src: '/xingshixian/origin_details_long.png',  scrollable: true  },
    after:  { src: '/xingshixian/updated_details_long.png', scrollable: true  },
  },
]
```

---

## Task 1: Append `PrototypeShowcase` to `xingshixian-charts.jsx`

**Files:**
- Modify: `content/projects/xingshixian-charts.jsx` (append after last export)

- [ ] **Step 1: Add `useEffect` to the existing React import**

The file currently imports only `useState` from React. Change line 1 of the import block:

```js
import { useState, useEffect } from 'react'
```

- [ ] **Step 2: Append the full `PrototypeShowcase` component**

Append the following at the **end** of `content/projects/xingshixian-charts.jsx` (after the `AttentionChart` export):

```jsx
// ── Prototype Showcase (Before / After) ──────────────────────────────
const SHOWCASE_PAGES = [
  {
    id: 'home',
    label: '首页',
    before: { src: '/xingshixian/origin_home.png',          scrollable: false },
    after:  { src: '/xingshixian/updated_home_long.png',    scrollable: true  },
  },
  {
    id: 'list',
    label: '列表',
    before: null,
    after:  { src: '/xingshixian/updated_list.png',         scrollable: false },
  },
  {
    id: 'purchase',
    label: '购买',
    before: { src: '/xingshixian/origin_purchase.png',      scrollable: false },
    after:  { src: '/xingshixian/updated_purchase.png',     scrollable: false },
  },
  {
    id: 'community',
    label: '社区',
    before: null,
    after:  { src: '/xingshixian/updated_community.png',    scrollable: false },
  },
  {
    id: 'details',
    label: '详情',
    before: { src: '/xingshixian/origin_details_long.png',  scrollable: true  },
    after:  { src: '/xingshixian/updated_details_long.png', scrollable: true  },
  },
]

const NAVY = '#2c4a7c'

function PhoneScreen({ entry }) {
  if (!entry) {
    return (
      <div style={{
        width: 260, height: 520, borderRadius: 32, border: '3px solid #ccc',
        background: '#f5f5f5', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: '#aaa', fontFamily: 'sans-serif' }}>暂无优化前版本</span>
      </div>
    )
  }

  if (entry.scrollable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 260,
          height: 520,
          borderRadius: 32,
          border: '3px solid #222',
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
        }}>
          {/* notch */}
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            width: 80, height: 20, borderRadius: 10, background: '#222', zIndex: 2,
          }} />
          {/* scrollable image */}
          <div style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingTop: 36,
            boxSizing: 'border-box',
          }}>
            <img src={entry.src} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        </div>
        <span style={{ marginTop: 6, fontSize: 12, color: '#888', fontFamily: 'sans-serif' }}>↑ 上滑查看完整页面</span>
      </div>
    )
  }

  // static — image already includes phone mockup from Figma export
  return (
    <img
      src={entry.src}
      alt=""
      style={{ maxHeight: 560, width: 'auto', flexShrink: 0, display: 'block', cursor: 'zoom-in' }}
    />
  )
}

export function PrototypeShowcase() {
  const [mode, setMode] = useState('after')
  const [activePage, setActivePage] = useState('home')
  const [lightboxSrc, setLightboxSrc] = useState(null)

  // ESC closes lightbox
  useEffect(() => {
    if (!lightboxSrc) return
    const handler = (e) => { if (e.key === 'Escape') setLightboxSrc(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxSrc])

  const page = SHOWCASE_PAGES.find(p => p.id === activePage)
  const entry = mode === 'before' ? page.before : page.after

  const handleStaticClick = () => {
    if (entry && !entry.scrollable) setLightboxSrc(entry.src)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', margin: '24px 0' }}>

      {/* Before / After toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {['before', 'after'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '6px 20px',
              borderRadius: 20,
              border: `2px solid ${NAVY}`,
              background: mode === m ? NAVY : 'transparent',
              color: mode === m ? '#fff' : NAVY,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {m === 'before' ? '优化前' : '优化后'}
          </button>
        ))}
      </div>

      {/* Page tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20, borderBottom: '1px solid #e5e9f2', paddingBottom: 8 }}>
        {SHOWCASE_PAGES.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePage(p.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 2px',
              borderBottom: activePage === p.id ? `2px solid ${NAVY}` : '2px solid transparent',
              color: activePage === p.id ? NAVY : '#888',
              fontWeight: activePage === p.id ? 700 : 400,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Phone display */}
      <div
        style={{ display: 'flex', justifyContent: 'center' }}
        onClick={entry && !entry.scrollable ? handleStaticClick : undefined}
      >
        <PhoneScreen entry={entry} />
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute', top: 20, right: 28,
              background: 'none', border: 'none',
              color: '#fff', fontSize: 32, cursor: 'pointer', lineHeight: 1,
            }}
          >×</button>
          <img
            src={lightboxSrc}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify the dev server renders without errors**

Run: `npm run dev` (already running? check the browser console)

Expected: No React errors. Navigate to the Xingshixian project detail page — the showcase hasn't appeared yet (we haven't added the `<chart>` tag), but the file should compile cleanly.

- [ ] **Step 4: Commit**

```bash
git add content/projects/xingshixian-charts.jsx
git commit -m "feat: add PrototypeShowcase component to xingshixian-charts"
```

---

## Task 2: Wire showcase into the Markdown

**Files:**
- Modify: `content/projects/xingshixian.md`

- [ ] **Step 1: Replace the empty `## Prototype Demo` section body**

Find this section at the end of `xingshixian.md`:

```markdown
## Prototype Demo / 原型展示


```

Replace with:

```markdown
## Prototype Demo / 原型展示

<chart id="PrototypeShowcase" />
```

- [ ] **Step 2: Verify in browser**

Open the Xingshixian project detail page. Expected:
- "优化前 / 优化后" pill buttons appear under the "Prototype Demo" heading
- "首页 / 列表 / 购买 / 社区 / 详情" tabs appear below
- Default state: mode=`优化后`, page=`首页` → `updated_home_long.png` inside a CSS phone shell with scroll
- Scrolling inside the phone shell works (mouse wheel or touch)
- Switching to `优化前` on 首页 → shows `origin_home.png` as static image
- Switching to `列表` in `优化前` mode → shows grey placeholder "暂无优化前版本"
- Clicking a static image → Lightbox opens; ESC and × both close it
- Switching to `详情` page → both before and after are scrollable

- [ ] **Step 3: Commit**

```bash
git add content/projects/xingshixian.md
git commit -m "feat: embed PrototypeShowcase in xingshixian prototype demo section"
```

---

## Self-Review Notes

- `origin_details_long.png` confirmed present in `public/xingshixian/` — used for `details.before.scrollable: true`
- `before: null` for `list` and `community` — placeholder renders correctly via `PhoneScreen` null-check
- `useEffect` import added in Task 1 Step 1 — consistent with its usage in Lightbox ESC handler
- Static images already include Figma mockup frame → no CSS phone shell wrapper needed for them
- Scrollable images have no Figma frame → CSS phone shell provides the frame
- Lightbox click-through prevention: `e.stopPropagation()` on the `<img>` inside lightbox prevents accidental close
