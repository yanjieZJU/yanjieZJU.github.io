// src/components/Education.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import '../App.css'
import './Education.css'

const entries = [
  {
    school: '浙江大学 计算机科学与技术学院',
    degree: '设计学 · 硕士（保研）',
    period: '2024.09 — 至今',
    desc: '研究方向：人与AI交互，关注大模型在设计支持、体验评估与智能交互中的应用',
    tags: ['优秀研究生', '五好研究生'],
  },
  {
    school: '浙江大学 计算机科学与技术学院',
    degree: '工业设计 · 本科（GPA 4.48/5.00，top 15%）',
    period: '2020.09 — 2024.06',
    desc: '主修课程：信息交互设计技术、用户体验与产品创新设计、数据结构基础、设计心理学',
    tags: ['浙江省政府奖学金 ×2', '校级二等奖学金', '校级优秀毕业生', '浙江省第十三届挑战杯金奖'],
  },
]

export default function Education() {
  const ref = useScrollAnimation()

  return (
    <section id="education" style={{ padding: '96px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 className="section-title fade-up" ref={ref}>教育经历</h2>
        <div className="education-timeline">
          {entries.map((entry, i) => (
            <EduItem key={i} entry={entry} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  )
}

function EduItem({ entry, delay }) {
  const ref = useScrollAnimation()

  return (
    <div
      className="edu-item fade-up"
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="edu-header">
        <span className="edu-school">{entry.school}</span>
        <span className="edu-period">{entry.period}</span>
      </div>
      <div className="edu-degree">{entry.degree}</div>
      <div className="edu-desc">{entry.desc}</div>
      <div className="edu-tags">
        {entry.tags.map((tag) => (
          <span key={tag} className="edu-tag">{tag}</span>
        ))}
      </div>
    </div>
  )
}
