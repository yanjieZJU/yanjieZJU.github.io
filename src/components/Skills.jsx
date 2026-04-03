import useScrollAnimation from '../hooks/useScrollAnimation'
import skillGroups from '../../content/skills.js'
import './Skills.css'

export default function Skills() {
  const titleRef = useScrollAnimation()

  return (
    <section id="skills" className="section-alt">
      <div className="section">
        <h2 className="section-heading fade-up" ref={titleRef}>Skills</h2>
        <div className="skills-grid">
          {skillGroups.map((group, i) => (
            <SkillGroup key={group.title} group={group} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SkillGroup({ group, delay }) {
  const ref = useScrollAnimation()

  return (
    <div className="skill-group fade-up" ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      <div className="skill-group-title">{group.title}</div>
      <div className="skill-pills">
        {group.pills.map((pill) => (
          <span key={pill} className="skill-pill">{pill}</span>
        ))}
      </div>
    </div>
  )
}

