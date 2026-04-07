import { useParams, Link } from 'react-router-dom'
import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import './ProjectDetail.css'

const mdFiles = import.meta.glob('../../content/projects/*.md', { query: '?raw', import: 'default', eager: true })
const chartModules = import.meta.glob('../../content/projects/*-charts.jsx', { eager: true })

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { data: {}, content: raw }
  const yaml = match[1]
  const content = raw.slice(match[0].length).trimStart()
  const data = {}
  for (const line of yaml.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (!m) continue
    const [, key, val] = m
    if (val.startsWith('[')) {
      data[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    } else if (!isNaN(val) && val !== '') {
      data[key] = Number(val)
    } else {
      data[key] = val.replace(/^['"]|['"]$/g, '')
    }
  }
  return { data, content }
}

function getCharts(slug) {
  const key = Object.keys(chartModules).find(k => k.includes(`/${slug}-charts.`))
  return key ? chartModules[key] : null
}

// Replace <chart id="Foo" /> with ```chart\nFoo\n``` so react-markdown handles it via code block
function preprocessCharts(content) {
  return content.replace(/<chart\s+id="([^"]+)"\s*\/?>/g, '\n```chart\n$1\n```\n')
}

// Extract ## headings from markdown content for TOC
function extractHeadings(content) {
  return [...content.matchAll(/^## (.+)$/gm)].map(m => ({
    text: m[1].replace(/\*\*/g, '').trim(),
    id: m[1].replace(/\*\*/g, '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, ''),
  }))
}

function slugToId(text) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')
}

function TableOfContents({ headings }) {
  if (headings.length === 0) return null
  return (
    <nav className="proj-toc">
      <div className="proj-toc-title">目录</div>
      <ul>
        {headings.map(h => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={e => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function findProject(slug) {
  for (const [path, raw] of Object.entries(mdFiles)) {
    const fileSlug = path.replace(/.*\/(.+)\.md$/, '$1')
    if (fileSlug === slug) {
      const { data, content } = parseFrontmatter(raw)
      return { ...data, slug: fileSlug, content }
    }
  }
  return null
}

export default function ProjectDetail() {
  const { slug } = useParams()
  const project = useMemo(() => findProject(slug), [slug])
  const charts = useMemo(() => getCharts(slug), [slug])

  const headings = useMemo(() => project ? extractHeadings(project.content) : [], [project])

  if (!project) {
    return (
      <div className="proj-not-found">
        <p>Project not found.</p>
        <Link to="/">← Back to home</Link>
      </div>
    )
  }

  // Build chart lookup: "VisitDepthChart" → <VisitDepthChart />
  const chartComponents = charts
    ? Object.fromEntries(
        Object.entries(charts)
          .filter(([k]) => k !== 'default')
          .map(([k, Comp]) => [k, Comp])
      )
    : {}

  return (
    <div className="proj-detail">
      <div className="proj-detail-layout">
        <TableOfContents headings={headings} />

        <div className="proj-detail-inner">
          <nav className="proj-breadcrumb">
            <Link to="/" state={{ scrollTarget: 'projects' }}>← Works</Link>
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
                GitHub
              </a>
            )}
            {project.paper && (
              <a className="proj-link-btn" href={project.paper} target="_blank" rel="noreferrer">
                Paper
              </a>
            )}
            {project.demo && (
              <a className="proj-link-btn" href={project.demo} target="_blank" rel="noreferrer">
                Demo
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
              components={{
                pre({ children }) {
                  return <>{children}</>
                },
                img({ src, alt }) {
                  if (src && /\.(mp4|webm|ogg)$/i.test(src)) {
                    return <video src={src} controls playsInline className="proj-video" title={alt} />
                  }
                  return <img src={src} alt={alt} />
                },
                h2({ children }) {
                  const text = String(children)
                  const id = slugToId(text)
                  return <h2 id={id}>{children}</h2>
                },
                code({ inline, className, children }) {
                  if (className === 'language-chart') {
                    const id = String(children).trim()
                    const Comp = chartComponents[id]
                    return Comp ? <Comp /> : <p style={{ color: 'red' }}>Chart &quot;{id}&quot; not found</p>
                  }
                  if (className === 'language-card') {
                    const raw = String(children).trim()
                    if (raw.includes('::')) {
                      const rows = raw.split('\n').filter(Boolean).map(line => {
                        const sep = line.indexOf('::')
                        if (sep === -1) return { label: '', text: line.trim() }
                        return { label: line.slice(0, sep).trim(), text: line.slice(sep + 2).trim() }
                      })
                      return (
                        <div className="proj-card">
                          {rows.map((row, i) => (
                            <div key={i} className="proj-card-row">
                              {row.label && <span className="proj-card-label">{row.label}</span>}
                              <div className="proj-card-text">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a({ href, children: c }) {
                                      const t = String(c)
                                      if (/^\d+$/.test(t.trim())) {
                                        return <sup><a href={href} target="_blank" rel="noreferrer" className="proj-ref">{t}</a></sup>
                                      }
                                      return <a href={href} target="_blank" rel="noreferrer">{c}</a>
                                    }
                                  }}
                                >
                                  {row.text}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div className="proj-highlight-card">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}
                          components={{
                            a({ href, children: c }) {
                              const t = String(c)
                              if (/^\d+$/.test(t.trim())) {
                                return <sup><a href={href} target="_blank" rel="noreferrer" className="proj-ref">{t}</a></sup>
                              }
                              return <a href={href} target="_blank" rel="noreferrer">{c}</a>
                            }
                          }}
                        >{raw}</ReactMarkdown>
                      </div>
                    )
                  }
                  if (inline) {
                    return <code className="proj-inline-code">{children}</code>
                  }
                  return (
                    <pre className="proj-code-block">
                      <code className={className}>{String(children).replace(/\n$/, '')}</code>
                    </pre>
                  )
                },
              }}
            >
              {preprocessCharts(project.content)}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
