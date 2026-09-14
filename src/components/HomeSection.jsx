import { Link } from 'react-router-dom'
import useScrollAnimation from '../hooks/useScrollAnimation'
import CardGrid from './CardGrid'
import './HomeSection.css'

export default function HomeSection({ id, alt, heading, files, basePath, linkLabel, limit = 3, moreLabel, sortByDate = false }) {
  const titleRef = useScrollAnimation()

  return (
    <section id={id} className={alt ? 'section-alt' : ''}>
      <div className="section">
        <div className="home-section-head">
          <h2 className="section-heading fade-up" ref={titleRef}>{heading}</h2>
          <Link className="home-view-all" to={basePath}>{moreLabel} →</Link>
        </div>
        <CardGrid files={files} basePath={basePath} linkLabel={linkLabel} limit={limit} sortByDate={sortByDate} />
      </div>
    </section>
  )
}
