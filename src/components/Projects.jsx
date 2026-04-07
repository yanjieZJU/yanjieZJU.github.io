import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useScrollAnimation from '../hooks/useScrollAnimation'
import './Projects.css'

const mdFiles = import.meta.glob('../../content/projects/*.md', { query: '?raw', import: 'default', eager: true })

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

function parseProjects() {
  return Object.entries(mdFiles)
    .map(([path, raw]) => {
      const { data, content } = parseFrontmatter(raw)
      const slug = path.replace(/.*\/(.+)\.md$/, '$1')
      const summary = extractTopSummary(content)
      const fallbackCover = extractFirstImage(content)
      const cover = data.cover || fallbackCover
      return { ...data, slug, summary, cover }
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}

function extractTopSummary(content) {
  const topBlock = content.split(/\r?\n##\s/)[0] ?? ''
  const lines = topBlock
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^(#|!|<|-|>)/.test(line))
  const preferredLine = lines.find(line => /[\u4e00-\u9fff]/.test(line)) ?? lines[0] ?? ''
  return preferredLine
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .trim()
}

function extractFirstImage(content) {
  const match = content.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/)
  return match ? match[1] : ''
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
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  return (
    <div className="project-card fade-up" ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      {project.cover && (
        <div className={`project-banner ${isImageLoaded ? 'is-loaded' : ''}`}>
          <img
            src={project.cover}
            alt={project.title_zh}
            loading="lazy"
            onLoad={() => setIsImageLoaded(true)}
          />
        </div>
      )}
      <span className="project-period">{project.period}</span>
      <h3 className="project-title-zh">{project.title_zh}</h3>
      <span className="project-role">{project.role_zh} / {project.role_en}</span>
      {project.summary && <p className="project-summary">{project.summary}</p>}
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
