import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { useState, useEffect } from 'react'

const ACCENT = '#2c4a7c'
const ACCENT_LIGHT = '#6b8cba'
const ACCENT_MUTED = '#eef2f9'

// ── 访问深度分布（水平条形图）──────────────────────────────────────────
const visitDepthData = [
  { label: '1次', count: 327, pct: '41.34%' },
  { label: '2次', count: 171, pct: '22.62%' },
  { label: '3次', count: 71,  pct: '8.98%'  },
  { label: '4次', count: 48,  pct: '6.07%'  },
  { label: '5次', count: 37,  pct: '4.68%'  },
  { label: '6-10次', count: 62, pct: '7.44%' },
  { label: '>10次', count: 75, pct: '9.48%' },
]

const CustomBarLabel = ({ x, y, width, index }) => (
  <text x={x + width + 6} y={y + 10} fill="#555" fontSize={12} dominantBaseline="middle">
    {visitDepthData[index].pct}
  </text>
)

export function VisitDepthChart() {
  return (
    <div className="chart-block">
      <div className="chart-title">访问深度分布（人数）</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={visitDepthData} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e9f2" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#444' }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            formatter={(v, _, { payload }) => [`${v} 人 (${payload.pct})`, '访问人数']}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #dde3ee' }}
          />
          <Bar dataKey="count" radius={[0, 3, 3, 0]} label={<CustomBarLabel />}>
            {visitDepthData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? ACCENT : i < 3 ? ACCENT_LIGHT : ACCENT_MUTED} stroke={i < 3 ? 'none' : '#c5cfe0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 竞品数据 ──────────────────────────────────────────────────────────
const competitors = [
  {
    name: '星世线 Cells',
    highlight: true,
    image: '/xingshixian/shoe-xingshixian.png',
    tags: ['露营风', '轻运动'],
    features: [
      { label: '核心技术', text: '超高速3D打印技术' },
      { label: '舒适度', text: '每个尺码都通过大数据计算晶格，保证穿着舒适度' },
      { label: '功能性', text: '全地形鞋，轻便且排水性强，适合露营、溯溪、登山、健身等多种场景' },
    ],
  },
  {
    name: 'Adidas Ultra 4D',
    highlight: false,
    image: '/xingshixian/shoe-adidas.png',
    tags: [],
    features: [
      { label: '', text: '4D打印中底 + 橡胶大底\n兼顾结构感与舒适性' },
    ],
  },
  {
    name: '匹克',
    highlight: false,
    image: '/xingshixian/shoe-peak.png',
    tags: [],
    features: [
      { label: '', text: '利用先进的HALS 3D打印技术\n100%可生物降解素材' },
    ],
  },
]

const radarData = [
  { dim: '价格',   xingshixian: 3, adidas: 4, peak: 4 },
  { dim: '外观',   xingshixian: 4, adidas: 5, peak: 4 },
  { dim: '品牌',   xingshixian: 2, adidas: 5, peak: 5 },
  { dim: '舒适度', xingshixian: 5, adidas: 4, peak: 3 },
  { dim: '功能性', xingshixian: 5, adidas: 4, peak: 3 },
]

const RADAR_COLORS = {
  xingshixian: '#183c7a',
  adidas:      '#a8c3f1',
  peak:        '#4474b6',
}

// ── 竞品对比：表格（左）+ 雷达图（右）────────────────────────────────
export function CompetitorTable() {
  return (
    <div className="chart-block">
      <div className="chart-title">竞品分析</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* 左：竞品表格 */}
        <div style={{ flex: '0 0 65%', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 1, background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
          {competitors.map((c) => (
            <div
              key={c.name}
              style={{
                background: c.highlight ? '#f4f7fd' : 'var(--color-bg)',
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: c.highlight ? 'var(--color-accent)' : '#1a1a1a' }}>
                {c.name}
              </div>

              {c.image && (
                <img src={c.image} alt={c.name} style={{ width: '100%', maxHeight: 100, objectFit: 'contain', mixBlendMode: 'multiply' }} />
              )}

              {c.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {c.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 2, background: 'var(--color-tag-bg)', color: 'var(--color-accent)', fontFamily: 'var(--font-sans)' }}>{tag}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.features.map((f, i) => (
                  <div key={i}>
                    {f.label && (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 2 }}>{f.label}</div>
                    )}
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{f.text}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 右：雷达图 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
              <PolarGrid stroke="#dde3ee" />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 12, fill: '#444' }} />
              <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
              <Radar name="星世线" dataKey="xingshixian" stroke={RADAR_COLORS.xingshixian} fill={RADAR_COLORS.xingshixian} fillOpacity={0.18} strokeWidth={2} />
              <Radar name="Adidas Ultra 4D" dataKey="adidas" stroke={RADAR_COLORS.adidas} fill={RADAR_COLORS.adidas} fillOpacity={0.12} strokeWidth={2} />
              <Radar name="匹克" dataKey="peak" stroke={RADAR_COLORS.peak} fill={RADAR_COLORS.peak} fillOpacity={0.12} strokeWidth={2} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #dde3ee' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  )
}

// ── 用户旅程桑基图 ────────────────────────────────────────────────────
// 数据来源：2022.07.31-08.31 页面访问明细，按访问次数聚合
// 流量逻辑：首页 → {商品列表, 用户中心, 商品详情} → {加入购物车, 退出} → {订单确认, 退出}
const SANKEY_NODES = [
  { name: '首页' },         // 0
  { name: '商品列表' },     // 1
  { name: '用户中心' },     // 2
  { name: '商品详情' },     // 3
  { name: '加入购物车' },   // 4
  { name: '订单确认页' },   // 5
  { name: '退出' },         // 6
]

const SANKEY_LINKS = [
  // 首页 → 二级页（用 visits - entry 近似内部流入）
  { source: 0, target: 1, value: 191  }, // 商品列表非入口访问
  { source: 0, target: 2, value: 378  }, // 用户中心非入口访问
  { source: 0, target: 3, value: 652  }, // 商品详情非入口访问
  { source: 0, target: 6, value: 1068 }, // 首页直接退出
  // 二级 → 商品详情 / 退出
  { source: 1, target: 3, value: 110  }, // 商品列表 → 商品详情
  { source: 1, target: 6, value: 66   }, // 商品列表 → 退出
  { source: 2, target: 6, value: 173  }, // 用户中心 → 退出
  // 商品详情 → 加入购物车 / 退出
  { source: 3, target: 4, value: 159  }, // 商品详情 → 加入购物车
  { source: 3, target: 6, value: 307  }, // 商品详情 → 退出
  // 加入购物车 → 订单确认 / 退出
  { source: 4, target: 5, value: 81   }, // 加入购物车 → 订单确认
  { source: 4, target: 6, value: 32   }, // 加入购物车 → 退出
  // 订单确认 → 退出
  { source: 5, target: 6, value: 32   },
]

const NODE_COLOR = '#2c4a7c'
const LINK_COLOR = 'rgba(44,74,124,0.15)'
const LINK_HOVER_COLOR = 'rgba(44,74,124,0.35)'

export function UserJourneySankey() {
  const [hoveredLink, setHoveredLink] = useState(null)
  const W = 700, H = 340, PAD = { top: 16, right: 100, bottom: 16, left: 80 }

  const layout = sankey()
    .nodeWidth(10)
    .nodePadding(18)
    .extent([[PAD.left, PAD.top], [W - PAD.right, H - PAD.bottom]])

  const { nodes, links } = layout({
    nodes: SANKEY_NODES.map(d => ({ ...d })),
    links: SANKEY_LINKS.map(d => ({ ...d })),
  })

  const path = sankeyLinkHorizontal()

  return (
    <div className="chart-block">
      <div className="chart-title">用户旅程桑基图 — 页面访问流（2022.07–08）</div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 480, height: 'auto', fontFamily: 'var(--font-sans)' }}>
          {/* Links */}
          {links.map((link, i) => (
            <path
              key={i}
              d={path(link)}
              fill="none"
              stroke={hoveredLink === i ? LINK_HOVER_COLOR : LINK_COLOR}
              strokeWidth={Math.max(1, link.width)}
              onMouseEnter={() => setHoveredLink(i)}
              onMouseLeave={() => setHoveredLink(null)}
              style={{ cursor: 'default', transition: 'stroke 0.15s' }}
            >
              <title>{link.source.name} → {link.target.name}: {link.value} 次</title>
            </path>
          ))}

          {/* Nodes */}
          {nodes.map((node, i) => (
            <g key={i}>
              <rect
                x={node.x0}
                y={node.y0}
                width={node.x1 - node.x0}
                height={Math.max(1, node.y1 - node.y0)}
                fill={NODE_COLOR}
                rx={2}
              />
              <text
                x={node.x0 < W / 2 ? node.x1 + 6 : node.x0 - 6}
                y={(node.y0 + node.y1) / 2}
                textAnchor={node.x0 < W / 2 ? 'start' : 'end'}
                dominantBaseline="middle"
                fontSize={12}
                fill="var(--color-text)"
              >
                {node.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
        * 数值单位为访问次数；流量根据入口页/退出页数据近似估算，悬停链接查看详情。
      </p>
    </div>
  )
}


// ── 问卷分析（水平条形图）──────────────────────────────────────────
const AttentionPerObject = [
  { label: '用户评价', count: 4.53 },
  { label: '商品优惠', count: 4.11},
  { label: '商品图片', count: 4.06 },
  { label: '商品成交量', count: 4.02 },
  { label: '商品技术分析', count: 3.90 },
  { label: '品牌故事', count: 3.06 },
]

const RationaleObject = [
  { label: '舒适感', count: 4.72 },
  { label: '外观', count: 4.16},
  { label: '易清洁度', count: 4.09 },
  { label: '功能性', count: 4.04 },
  { label: '价格', count: 3.96 },
  { label: '品牌', count: 3.43 },
]

const AttentionBarLabel = ({ x, y, width, index }) => (
  <text x={x + width + 6} y={y + 10} fill="#555" fontSize={12} dominantBaseline="middle">
    {AttentionPerObject[index].count}
  </text>
)

const RationaleBarLabel = ({ x, y, width, index }) => (
  <text x={x + width + 6} y={y + 10} fill="#555" fontSize={12} dominantBaseline="middle">
    {RationaleObject[index].count}
  </text>
)

export function AttentionChart() {
  return (
    <div className="chart-block">
      <div className="chart-title">购物App中对各项目的关注程度</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={AttentionPerObject} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e9f2" />
          <XAxis type="number" domain={[0,5]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#444' }} axisLine={false} tickLine={false} width={88} />
          <Tooltip
            formatter={(v, _, { payload }) => [`${v} 人 (${payload.pct})`, '访问人数']}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #dde3ee' }}
          />
          <Bar dataKey="count" radius={[0, 3, 3, 0]} label={<AttentionBarLabel />}>
            {AttentionPerObject.map((_, i) => (
              <Cell key={i} fill={i === 0 ? ACCENT : i < 3 ? ACCENT_LIGHT : ACCENT_MUTED} stroke={i < 3 ? 'none' : '#c5cfe0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="chart-title">选择童鞋的主要依据</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={RationaleObject} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e9f2" />
          <XAxis type="number" domain={[0,5]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#444' }} axisLine={false} tickLine={false} width={88} />
          <Tooltip
            formatter={(v, _, { payload }) => [`${v} 人 (${payload.pct})`, '访问人数']}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #dde3ee' }}
          />
          <Bar dataKey="count" radius={[0, 3, 3, 0]} label={<RationaleBarLabel />}>
            {RationaleObject.map((_, i) => (
              <Cell key={i} fill={i === 0 ? ACCENT : i < 3 ? ACCENT_LIGHT : ACCENT_MUTED} stroke={i < 3 ? 'none' : '#c5cfe0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

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