import { useMemo, useRef, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import CardGrid from './CardGrid'
import TaxonomyTree from './TaxonomyTree'
import useScrollAnimation from '../hooks/useScrollAnimation'
import { loadPosts } from '../lib/posts'
import './ListPage.css'

export default function ListPage({ files, basePath, heading, description, categorize = false }) {
  const titleRef = useScrollAnimation()
  const listRef = useRef(null)
  const { search } = useLocation()
  const fromDetail = useMemo(() => new URLSearchParams(search).get('from') === 'detail', [search])
  const [selected, setSelected] = useState(null)

  const posts = useMemo(() => (categorize ? loadPosts(files, { sortByDate: true }) : []), [files, categorize])

  const filteredPosts = useMemo(() => {
    if (!selected) return posts
    return posts.filter(p => selected.slugs.has(p.slug))
  }, [posts, selected])

  useEffect(() => {
    if (fromDetail && listRef.current) {
      listRef.current.scrollIntoView({ block: 'start' })
    }
  }, [fromDetail])

  return (
    <section id={basePath.slice(1)} className={`list-page${categorize ? ' list-page-categorized' : ''}`}>
      <div className="section">
        <h2 className="section-heading fade-up" ref={titleRef}>{heading}</h2>
        {description && <p className="list-page-desc fade-up">{description}</p>}
        {categorize && (
          <>
            <TaxonomyTree
              posts={posts}
              selectedId={selected ? selected.id : null}
              onSelect={setSelected}
            />
            <div className="taxonomy-status" ref={listRef}>
              {selected ? (
                <>
                  <span className="taxonomy-status-path">{selected.path.join(' / ')}</span>
                  <span className="taxonomy-status-count">{filteredPosts.length} 篇</span>
                  <button type="button" className="taxonomy-status-clear" onClick={() => setSelected(null)}>
                    清除筛选
                  </button>
                </>
              ) : (
                <span className="taxonomy-status-count">共 {posts.length} 篇</span>
              )}
            </div>
          </>
        )}
        {!categorize && <div ref={listRef} />}
        {selected && filteredPosts.length === 0 && (
          <p className="taxonomy-empty">该分类下暂无文章</p>
        )}
        <CardGrid
          files={files}
          basePath={basePath}
          linkLabel={basePath === '/blog' ? 'View Post →' : 'View Project →'}
          sortByDate={categorize}
          posts={categorize ? filteredPosts : undefined}
        />
      </div>
    </section>
  )
}
