// 博客分类树（思维导图式，可自由扩展）
//
// 节点格式：{ label: '名称', tags: ['匹配的标签'], children: [子节点] }
// - 叶子节点用 tags 匹配文章 frontmatter 里的 tags，任一命中即归入；
//   一篇文章可以同时属于多个叶子（如既在「Agent」又在「产品知识」下）
// - 分支节点的筛选范围 = 自身 tags + 所有后代 tags 的并集
// - 没有命中任何叶子的文章会自动归入「其他」节点，不会丢失
//
// 扩展示例：
// - 新增一级大类：在 children 里加 { label: '个人随笔', tags: ['随笔'] }
// - 「实习复盘」以后写多了，升级为分支：
//     { label: '实习复盘', children: [
//       { label: '智谱', tags: ['实习复盘', '智谱'] },
//       { label: '其他公司', tags: ['XX实习'] },
//     ] }
export default {
  label: '全部',
  children: [
    {
      label: '学习笔记',
      children: [
        { label: '产品知识', tags: ['产品'] },
        {
          label: 'AI 知识',
          children: [
            { label: 'Agent', tags: ['Agent', 'Coding Agent', 'Claude Code'] },
            { label: 'Harness', tags: ['Harness'] },
            { label: '评测', tags: ['评测', 'Rubric'] },
          ],
        },
      ],
    },
    { label: '实习复盘', tags: ['实习复盘'] },
  ],
}
