import useScrollAnimation from '../hooks/useScrollAnimation'
import entries from '../../content/education.js'
import './Education.css'

export default function Education() {
  const ref = useScrollAnimation()

  return (
    <section id="education" className="section-alt">
      <div className="section">
        <h2 className="section-heading fade-up" ref={ref}>Education</h2>
        <div className="edu-list">
          {entries.map((entry, i) => (
            <EduItem key={i} entry={entry} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

function EduItem({ entry, delay }) {
  const ref = useScrollAnimation()

  return (
    <div className="edu-item fade-up" ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      <div className="edu-header">
        <div>
          <div className="edu-school-zh">{entry.schoolZh}</div>
          <div className="edu-school-en">{entry.schoolEn}</div>
        </div>
        <span className="edu-period">{entry.period}</span>
      </div>
      <div className="edu-degree-zh">{entry.degreeZh}</div>
      <div className="edu-degree-en">{entry.degreeEn}</div>
      <div className="edu-desc-zh">{entry.descZh}</div>
      <div className="edu-desc-en">{entry.descEn}</div>
      <div className="edu-tags">
        {entry.awards.map((award) => (
          <span key={award} className="edu-tag">{award}</span>
        ))}
      </div>
    </div>
  )
}
