import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadPosts } from '../lib/posts'
import './BlogGraph.css'

const WIDTH = 860
const HEIGHT = 580
const TAG_RING_RX = 300
const TAG_RING_RY = 220
const LINK_LENGTH = 110
const REPULSION = 5200
const ITERATIONS = 320

function buildGraph(files) {
  const posts = loadPosts(files)
  const tagMap = new Map()
  const postNodes = []
  const links = []

  posts.forEach(p => {
    const pid = `post-${p.slug}`
    postNodes.push({ id: pid, type: 'post', title: p.title_zh, slug: p.slug })
    ;(p.tags ?? []).forEach(t => {
      const tid = `tag-${t}`
      if (!tagMap.has(tid)) tagMap.set(tid, { id: tid, type: 'tag', title: t, count: 0 })
      tagMap.get(tid).count += 1
      links.push({ source: pid, target: tid })
    })
  })

  const tagNodes = [...tagMap.values()]
  tagNodes.forEach((n, i) => {
    const a = (i / Math.max(tagNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
    n.x = WIDTH / 2 + Math.cos(a) * TAG_RING_RX
    n.y = HEIGHT / 2 + Math.sin(a) * TAG_RING_RY
    n.fixed = true
  })
  postNodes.forEach(n => {
    n.x = WIDTH / 2 + (Math.random() - 0.5) * 340
    n.y = HEIGHT / 2 + (Math.random() - 0.5) * 260
  })

  const nodes = [...tagNodes, ...postNodes]
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  links.forEach(l => { l.source = byId[l.source]; l.target = byId[l.target] })
  return { nodes, links }
}

export default function BlogGraph({ files, basePath }) {
  const navigate = useNavigate()
  const graph = useMemo(() => buildGraph(files), [files])
  const [, setTick] = useState(0)
  const [hoverId, setHoverId] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const dragRef = useRef(null)
  const simRef = useRef({ alpha: 1 })
  const rafRef = useRef(0)

  const neighbors = useMemo(() => {
    if (!hoverId && !selectedTag) return null
    const focusId = hoverId ?? selectedTag
    const set = new Set([focusId])
    graph.links.forEach(l => {
      if (l.source.id === focusId) set.add(l.target.id)
      if (l.target.id === focusId) set.add(l.source.id)
    })
    return set
  }, [hoverId, selectedTag, graph])

  const tick = useCallback(() => {
    const { nodes, links } = graph
    const sim = simRef.current
    // pairwise repulsion
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        let dx = b.x - a.x, dy = b.y - a.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) { d2 = 1; dx = Math.random() - 0.5; dy = Math.random() - 0.5 }
        const f = REPULSION / d2
        const d = Math.sqrt(d2)
        const fx = (dx / d) * f, fy = (dy / d) * f
        if (!a.fixed) { a._vx = (a._vx ?? 0) - fx; a._vy = (a._vy ?? 0) - fy }
        if (!b.fixed) { b._vx = (b._vx ?? 0) + fx; b._vy = (b._vy ?? 0) + fy }
      }
    }
    // spring attraction along links
    links.forEach(l => {
      const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d - LINK_LENGTH) * 0.06
      const fx = (dx / d) * f, fy = (dy / d) * f
      if (!l.source.fixed) { l.source._vx = (l.source._vx ?? 0) + fx; l.source._vy = (l.source._vy ?? 0) + fy }
      if (!l.target.fixed) { l.target._vx = (l.target._vx ?? 0) - fx; l.target._vy = (l.target._vy ?? 0) - fy }
    })
    // gravity to center + integrate
    nodes.forEach(n => {
      if (n.fixed) { n._vx = 0; n._vy = 0; return }
      n._vx = (n._vx ?? 0) * 0.82 + (WIDTH / 2 - n.x) * 0.004
      n._vy = (n._vy ?? 0) * 0.82 + (HEIGHT / 2 - n.y) * 0.004
      n.x += Math.max(-12, Math.min(12, n._vx * sim.alpha))
      n.y += Math.max(-12, Math.min(12, n._vy * sim.alpha))
      n.x = Math.max(50, Math.min(WIDTH - 50, n.x))
      n.y = Math.max(30, Math.min(HEIGHT - 30, n.y))
    })
    sim.alpha *= 0.995
    setTick(t => t + 1)
  }, [graph])

  useEffect(() => {
    let i = 0
    const loop = () => {
      tick()
      i += 1
      if (i < ITERATIONS) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  const wake = useCallback(() => {
    simRef.current.alpha = Math.max(simRef.current.alpha, 0.5)
    cancelAnimationFrame(rafRef.current)
    let i = 0
    const loop = () => {
      tick()
      i += 1
      if (i < 120) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [tick])

  const toLocal = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (HEIGHT / rect.height),
    }
  }

  const onPointerDown = (node) => (e) => {
    e.preventDefault()
    if (node.type === 'post') {
      node.fixed = true
      dragRef.current = node
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e) => {
    const node = dragRef.current
    if (!node) return
    const { x, y } = toLocal(e)
    node.x = x
    node.y = y
    wake()
  }

  const onPointerUp = (node) => () => {
    if (dragRef.current === node) {
      node.fixed = false
      dragRef.current = null
      wake()
    }
  }

  const onClickNode = (node) => () => {
    if (node.type === 'post') {
      navigate(`${basePath}/${node.slug}`)
    } else {
      setSelectedTag(prev => prev === node.id ? null : node.id)
    }
  }

  const isDimmed = (id) => neighbors && !neighbors.has(id)

  return (
    <div className="blog-graph">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="blog-graph-svg"
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          if (dragRef.current) { dragRef.current.fixed = false; dragRef.current = null; wake() }
        }}
      >
        {graph.links.map((l, i) => {
          const dim = neighbors && !(neighbors.has(l.source.id) && neighbors.has(l.target.id))
          const active = neighbors && (l.source.id === (hoverId ?? selectedTag) || l.target.id === (hoverId ?? selectedTag))
          return (
            <line
              key={i}
              className={`graph-edge${active ? ' active' : ''}${dim ? ' dim' : ''}`}
              x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
            />
          )
        })}
        {graph.nodes.map(n => {
          const dim = isDimmed(n.id)
          const selected = n.id === selectedTag
          return (
            <g
              key={n.id}
              className={`graph-node ${n.type}${dim ? ' dim' : ''}${selected ? ' selected' : ''}`}
              transform={`translate(${n.x},${n.y})`}
              onPointerDown={onPointerDown(n)}
              onPointerUp={onPointerUp(n)}
              onPointerEnter={() => setHoverId(n.id)}
              onPointerLeave={() => setHoverId(null)}
              onClick={onClickNode(n)}
            >
              {n.type === 'tag' ? (
                <>
                  <circle r={Math.max(10, 8 + n.count * 2.2)} />
                  <text className="graph-label tag" textAnchor="middle" dy="-16">
                    {n.title} ({n.count})
                  </text>
                </>
              ) : (
                <>
                  <circle r={5} />
                  <text className="graph-label post" textAnchor="middle" dy="18">
                    {n.title.length > 12 ? n.title.slice(0, 12) + '…' : n.title}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <p className="blog-graph-hint">
        悬停高亮关联 · 拖拽移动节点 · 点击标签筛选 · 点击文章进入详情
      </p>
    </div>
  )
}
