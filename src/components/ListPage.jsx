import { useMemo, useRef, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import CardGrid from './CardGrid'
import BlogGraph from './BlogGraph'
import useScrollAnimation from '../hooks/useScrollAnimation'
import { loadPosts } from '../lib/posts'
import './ListPage.css'

export default function ListPage({ files, basePath, heading, description, enableGraph = false, enableFilter = false }) {
  const titleRef = useScrollAnimation()
  const listRef = useRef(null)
  const { search } = useLocation()
  const fromDetail = useMemo(() => new URLSearchParams(search).get('from') === 'detail', [search])
  const [view, setView] = useState('list')
  const [activeTags, setActiveTags] = useState([])

  const posts = useMemo(() => (enableFilter ? loadPosts(files, { sortByDate: true }) : []), [files, enableFilter])
  const allTags = useMemo(() => {
    if (!enableFilter) return []
    const counts = new Map()
    posts.forEach(p => (p.tags ?? []).forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [posts, enableFilter])

  const filteredPosts = useMemo(() => {
    if (activeTags.length === 0) return posts
    return posts.filter(p => activeTags.every(t => (p.tags ?? []).includes(t)))
  }, [posts, activeTags])

  useEffect(() => {
    if (fromDetail && listRef.current) {
      listRef.current.scrollIntoView({ block: 'start' })
    }
  }, [fromDetail])

  const toggleTag = (tag) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  return (
    <section id={basePath.slice(1)} className="list-page">
      <div className="section">
        <h2 className="section-heading fade-up" ref={titleRef}>{heading}</h2>
        {description && <p className="list-page-desc fade-up">{description}</p>}
        {enableGraph && (
          <div className="list-view-toggle" role="tablist">
            <button
              role="tab"
              aria-selected={view === 'list'}
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
            >
              列表
            </button>
            <button
              role="tab"
              aria-selected={view === 'graph'}
              className={view === 'graph' ? 'active' : ''}
              onClick={() => setView('graph')}
            >
              图谱
            </button>
          </div>
        )}
        {enableFilter && view === 'list' && (
          <div className="tag-filter">
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                className={`tag-filter-btn${activeTags.includes(tag) ? ' active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag} <span className="tag-filter-count">{count}</span>
              </button>
            ))}
            {activeTags.length > 0 && (
              <button className="tag-filter-clear" onClick={() => setActiveTags([])}>
                清除筛选
              </button>
            )}
          </div>
        )}
        <div ref={listRef} />
        {enableGraph && view === 'graph' ? (
          <BlogGraph files={files} basePath={basePath} />
        ) : enableFilter ? (
          <CardGrid files={files} basePath={basePath} linkLabel={basePath === '/blog' ? 'View Post →' : 'View Project →'} sortByDate posts={filteredPosts} />
        ) : (
          <CardGrid files={files} basePath={basePath} linkLabel={basePath === '/blog' ? 'View Post →' : 'View Project →'} />
        )}
      </div>
    </section>
  )
}
