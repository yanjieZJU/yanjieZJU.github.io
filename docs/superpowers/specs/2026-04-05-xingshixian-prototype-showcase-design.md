# Xingshixian Prototype Showcase — Design Spec

**Date:** 2026-04-05  
**Status:** Approved

## Goal

Add an interactive Before/After UI showcase to the Xingshixian project detail page. Visitors can toggle between the original and redesigned mini-program interfaces, switch between pages, and scroll through full-length screens for the redesigned home and detail pages.

---

## Architecture

A single React component `PrototypeShowcase` is added to `content/projects/xingshixian-charts.jsx`, which already exists and is loaded by `ProjectDetail.jsx` via the `<chart id="PrototypeShowcase" />` mechanism. No changes to the rendering framework are required.

Invocation in `content/projects/xingshixian.md` under `## Prototype Demo / 原型展示`:

```markdown
<chart id="PrototypeShowcase" />
```

---

## Component Structure

```
PrototypeShowcase
├── BeforeAfterTabs        // "优化前 / 优化后" toggle buttons
├── PageTabs               // "首页 / 列表 / 购买 / 社区 / 详情" page selector
└── PhoneDisplay           // renders the correct screen type
    ├── ScrollablePhone    // for home + detail: CSS phone shell + overflow-y scroll
    └── StaticPhone        // for other pages: static mockup image, click to lightbox
└── Lightbox               // fullscreen modal for static pages
```

---

## State

| State | Type | Values |
|---|---|---|
| `mode` | string | `'before'` \| `'after'` |
| `activePage` | string | `'home'` \| `'list'` \| `'purchase'` \| `'community'` \| `'details'` |
| `lightboxOpen` | boolean | `true` \| `false` |

Switching `mode` keeps `activePage` unchanged. Switching `activePage` keeps `mode` unchanged.

---

## Page Data

```js
const PAGES = [
  {
    id: 'home',
    label: '首页',
    before: { src: '/xingshixian/origin_home.png',         scrollable: false },
    after:  { src: '/xingshixian/updated_home_long.png',   scrollable: true  },
  },
  {
    id: 'list',
    label: '列表',
    before: null,   // no original version available
    after:  { src: '/xingshixian/updated_list.png',        scrollable: false },
  },
  {
    id: 'purchase',
    label: '购买',
    before: { src: '/xingshixian/origin_purchase.png',     scrollable: false },
    after:  { src: '/xingshixian/updated_purchase.png',    scrollable: false },
  },
  {
    id: 'community',
    label: '社区',
    before: null,   // no original version available
    after:  { src: '/xingshixian/updated_community.png',   scrollable: false },
  },
  {
    id: 'details',
    label: '详情',
    before: { src: '/xingshixian/origin_details.png',      scrollable: false },
    after:  { src: '/xingshixian/updated_details_long.png',scrollable: true  },
  },
]
```

- `scrollable: true` → ScrollablePhone（CSS 手机壳 + overflow-y scroll + 无样机长截图）
- `scrollable: false` → StaticPhone（带样机静态图，点击 Lightbox 放大）
- `before: null` 时显示占位：灰色框 + "暂无优化前版本"

---

## Visual Design

### BeforeAfterTabs
- Two pill-shaped buttons side by side, centered
- Active: filled navy (`#2c4a7c`), white text
- Inactive: outlined, navy text

### PageTabs
- Five text tabs below BeforeAfterTabs, separated by gap
- Active: underline + navy color
- Inactive: grey text

### ScrollablePhone (优化后首页 + 优化后详情页)
- Pure CSS phone shell: `width: 280px`, `border-radius: 36px`, `border: 3px solid #222`, notch bar at top
- Inner screen: `height: 560px`, `overflow-y: auto`, `-webkit-overflow-scrolling: touch`
- Image inside: `width: 100%`, `height: auto` (natural long height, no mockup frame)
- Scroll hint text below: "↑ 上滑查看完整页面"

### StaticPhone (所有其他组合：原始首页/详情页 + 列表/购买/社区)
- Display the mockup image (which already includes phone shell graphics from Figma export)
- `max-height: 620px`, `width: auto`, cursor pointer
- On click: open Lightbox

### Lightbox
- Full viewport overlay, dark semi-transparent background
- Image centered, `max-height: 90vh`, `max-width: 90vw`, object-fit contain
- Click backdrop or × button to close
- ESC key also closes

---

## Image Assets Required

The following files must be exported from Figma (no phone shell, full page height) and placed in `public/xingshixian/`:

| Filename | Description |
|---|---|
| `updated_home_long.png` | Redesigned home page, full height, no mockup frame |
| `updated_details_long.png` | Redesigned detail page, full height, no mockup frame |

All other files already exist and are used as-is.

---

## Implementation Notes

- All styles go inline or in a `<style>` tag inside the JSX component — no new CSS file needed, consistent with how other chart components in `xingshixian-charts.jsx` work
- The component is self-contained; it imports nothing beyond React
- Lightbox uses `useEffect` for ESC key listener with cleanup
- No external libraries

---

## Out of Scope

- Real Figma prototype embedding (iframe approach)
- Left-right slider comparison
- Animation between before/after states
