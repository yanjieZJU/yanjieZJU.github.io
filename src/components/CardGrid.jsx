import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useScrollAnimation from '../hooks/useScrollAnimation'
import { loadPosts } from '../lib/posts'
import './CardGrid.css'

export default function CardGrid({ files, basePath, linkLabel = 'View Project →', limit, sortByDate = false, posts: postsProp }) {
  const posts = useMemo(
    () => (postsProp ?? loadPosts(files, { sortByDate })).slice(0, limit ?? Infinity),
    [postsProp, files, limit, sortByDate]
  )

  return (
    <div className="projects-grid">
      {posts.map((post, i) => (
        <Card key={post.slug} post={post} delay={i * 80} basePath={basePath} linkLabel={linkLabel} />
      ))}
    </div>
  )
}

export function Card({ post, delay, basePath, linkLabel }) {
  const ref = useScrollAnimation()
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const role = [post.role_zh, post.role_en].filter(Boolean).join(' / ')

  return (
    <div className="project-card fade-up" ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      {post.cover && (
        <div className={`project-banner ${isImageLoaded ? 'is-loaded' : ''}`}>
          <img
            src={post.cover}
            alt={post.title_zh}
            loading="lazy"
            onLoad={() => setIsImageLoaded(true)}
          />
        </div>
      )}
      <span className="project-period">{post.period}</span>
      <h3 className="project-title-zh">{post.title_zh}</h3>
      {role && <span className="project-role">{role}</span>}
      {post.summary && <p className="project-summary">{post.summary}</p>}
      <div className="project-tags">
        {(post.tags ?? []).map((tag) => (
          <span key={tag} className="project-tag">{tag}</span>
        ))}
      </div>
      <Link className="project-link" to={`${basePath}/${post.slug}`}>
        {linkLabel}
      </Link>
    </div>
  )
}
