export function parseFrontmatter(raw) {
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

export function extractTopSummary(content) {
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

export function extractFirstImage(content) {
  const match = content.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/)
  return match ? match[1] : ''
}

// "2026.04" / "2024.10 — 2025.11 | ..." → "2026.04"（用于日期排序比较）
export function parsePeriod(period) {
  if (!period) return ''
  const m = String(period).match(/(\d{4})\.(\d{1,2})/)
  return m ? `${m[1]}.${m[2].padStart(2, '0')}` : String(period)
}

// files: import.meta.glob result of raw md contents → post list
export function loadPosts(files, { sortByDate = false } = {}) {
  const posts = Object.entries(files)
    .map(([path, raw]) => {
      const { data, content } = parseFrontmatter(raw)
      const slug = path.replace(/.*\/(.+)\.md$/, '$1')
      const summary = extractTopSummary(content)
      const cover = data.cover || extractFirstImage(content)
      return { ...data, slug, summary, cover }
    })
  if (sortByDate) {
    posts.sort((a, b) =>
      parsePeriod(b.period).localeCompare(parsePeriod(a.period)) ||
      (a.order ?? 99) - (b.order ?? 99)
    )
  } else {
    posts.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  }
  return posts
}
