import { useMemo, useState } from 'react'
import './TaxonomyTree.css'

// 文章是否归入该节点（子树内任一 tag 命中，或显式 slug 命中）
function matchesNode(post, node) {
  if (node.slugs?.has(post.slug)) return true
  return node.tags.some(t => (post.tags ?? []).includes(t))
}

// 递归补全节点：id、label 路径、子树累计 tags、命中文章数
function decorate(node, posts, parentPath) {
  const path = [...parentPath, node.label]
  const children = (node.children ?? []).map(c => decorate(c, posts, path))
  const tags = [...new Set([...(node.tags ?? []), ...children.flatMap(c => c.tags)])]
  const full = { ...node, id: path.join('/'), path, tags, children }
  full.count = posts.filter(p => matchesNode(p, full)).length
  return full
}

function TreeItem({ node, selectedId, onSelect, collapsed, onToggle }) {
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.id)
  const isSelected = selectedId === node.id
  const isAncestor = !!selectedId && !isSelected && selectedId.startsWith(node.id + '/')

  return (
    <li
      className={[
        'tree-item',
        hasChildren ? 'branch' : 'leaf',
        isCollapsed ? 'collapsed' : '',
        isAncestor ? 'ancestor' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="tree-row">
        {hasChildren ? (
          <button
            type="button"
            className="tree-twisty"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? '展开' : '收起'}「${node.label}」`}
            onClick={() => onToggle(node.id)}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <span className="tree-leaf-dot" aria-hidden="true" />
        )}
        <button
          type="button"
          className={`tree-label${isSelected ? ' selected' : ''}`}
          title={node.path.join(' / ')}
          onClick={() => onSelect(isSelected ? null : node)}
        >
          {node.label}
          <span className="tree-count">{node.count}</span>
        </button>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="tree-children">
          {node.children.map(c => (
            <TreeItem key={c.id} node={c} selectedId={selectedId} onSelect={onSelect} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function TaxonomyTree({ taxonomy, posts, selectedId, onSelect }) {
  const [collapsed, setCollapsed] = useState(() => new Set())

  const root = useMemo(() => {
    const base = decorate(taxonomy, posts, [])
    const definedTags = new Set(base.tags)
    const rest = posts.filter(p => !(p.tags ?? []).some(t => definedTags.has(t)))
    if (rest.length === 0) return base
    const other = decorate(
      { label: '其他', tags: [], slugs: new Set(rest.map(p => p.slug)) },
      posts,
      base.path
    )
    return { ...base, children: [...base.children, other] }
  }, [taxonomy, posts])

  const onToggle = (id) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="taxonomy-tree">
      <button
        type="button"
        className={`taxonomy-root-btn${!selectedId ? ' active' : ''}`}
        onClick={() => onSelect(null)}
      >
        {root.label}
        <span className="tree-count">{posts.length}</span>
      </button>
      <ul className="tree-root">
        {root.children.map(node => (
          <TreeItem key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} collapsed={collapsed} onToggle={onToggle} />
        ))}
      </ul>
    </div>
  )
}
