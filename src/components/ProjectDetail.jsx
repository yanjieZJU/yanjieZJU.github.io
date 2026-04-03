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
