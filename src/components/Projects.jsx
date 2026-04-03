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
