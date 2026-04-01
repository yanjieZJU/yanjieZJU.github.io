// src/components/Skills.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import '../App.css'
import './Skills.css'

const skillGroups = [
  {
    title: '语言能力',
    pills: ['英语 CET-6（615）'],
  },
  {
    title: '产品技能',
    pills: ['用户调研', '需求分析', '交互原型设计', 'Figma', '数据分析（SPSS）'],
  },
  {
    title: 'AI 产品能力',
    pills: ['Prompt 设计', 'RAG', '指令微调', 'AI Agent 编排（Coze）', 'AIGC 工具（ComfyUI）'],
  },
  {
    title: '开发协作',
    pills: ['AI 编程工具（Antigravity）', 'TRAE'],
  },
]

export default function Skills() {
  const titleRef = useScrollAnimation()

  return (
    <section id="skills" style={{ padding: '96px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 className="section-title fade-up" ref={titleRef}>个人技能</h2>
        <div className="skills-grid">
          {skillGroups.map((group, i) => (
            <SkillGroup key={group.title} group={group} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SkillGroup({ group, delay }) {
  const ref = useScrollAnimation()

  return (
    <div
      className="skill-group fade-up"
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="skill-group-title">{group.title}</div>
      <div className="skill-pills">
        {group.pills.map((pill) => (
          <span key={pill} className="skill-pill">{pill}</span>
        ))}
      </div>
    </div>
  )
}
