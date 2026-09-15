import { useMemo } from 'react'
import './TaxonomyTree.css'

// 分类树由文章 frontmatter 的 category 字段自动生成，无需单独维护配置：
//   category: 学习笔记/AI 知识/Agent                          ← 单个路径
//   category: [学习笔记/AI 知识/评测, 学习笔记/AI 知识/Agent]   ← 一篇可属多个路径
// 路径以 / 分层；同名路径段自动合并为同一节点（写法需一致，如统一用「AI 知识」）。
// 没写 category 的文章自动归入「其他」；分类下没有文章则整支不出现。

function categoryPaths(post) {
  const raw = post.category
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list
    .map(s => String(s).split('/').map(seg => seg.trim()).filter(Boolean))
    .filter(segs => segs.length > 0)
}

function buildTree(posts) {
  const root = { label: '全部', children: new Map(), slugs: new Set() }
  const other = { label: '其他', children: new Map(), slugs: new Set() }

  posts.forEach(p => {
    root.slugs.add(p.slug)
    const paths = categoryPaths(p)
    if (paths.length === 0) {
      other.slugs.add(p.slug)
      return
    }
    paths.forEach(segs => {
      let node = root
      segs.forEach(seg => {
        if (!node.children.has(seg)) node.children.set(seg, { label: seg, children: new Map(), slugs: new Set() })
        node = node.children.get(seg)
        node.slugs.add(p.slug)
      })
    })
  })

  // 补全路径/计数，兄弟节点按文章数降序排列
  const finalize = (node, parentPath) => {
    node.path = [...parentPath, node.label]
    node.id = node.path.join('/')
    node.count = node.slugs.size
    node.children = [...node.children.values()]
      .map(c => finalize(c, node.path))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh'))
    return node
  }
  finalize(root, [])
  if (other.slugs.size > 0) {
    finalize(other, root.path)
    root.children.push(other)
  }
  return root
}

function TreeNode({ node, depth, selectedId, onSelect }) {
  const isRoot = depth === 0
  const isSelected = selectedId === node.id
  const isAncestor = !!selectedId && !isSelected && selectedId.startsWith(node.id + '/')

  return (
    <li className={`tt-item${isRoot ? ' tt-root' : ''}`}>
      <button
        type="button"
        className={[
          'tt-node',
          `d${Math.min(depth, 3)}`,
          isSelected ? 'selected' : '',
          isAncestor ? 'ancestor' : '',
        ].filter(Boolean).join(' ')}
        aria-pressed={isRoot ? !selectedId : isSelected}
        title={node.path.join(' / ')}
        onClick={() => {
          if (isRoot || isSelected) onSelect(null)
          else onSelect({ id: node.id, path: node.path.slice(1), slugs: node.slugs })
        }}
      >
        {node.label}
        <span className="tt-count">{node.count}</span>
      </button>
      {node.children.length > 0 && (
        <ul className="tt-kids">
          {node.children.map(c => (
            <TreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function TaxonomyTree({ posts, selectedId, onSelect }) {
  const root = useMemo(() => buildTree(posts), [posts])

  return (
    <div className="taxonomy-tree">
      <div className="tt-wrap">
        <ul className="tt-tree">
          <TreeNode node={root} depth={0} selectedId={selectedId} onSelect={onSelect} />
        </ul>
      </div>
    </div>
  )
}
