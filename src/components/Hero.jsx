import useScrollAnimation from '../hooks/useScrollAnimation'
import avatar from '../assets/avatar.svg'
import profile from '../../content/profile.js'
import './Hero.css'

export default function Hero() {
  const ref = useScrollAnimation(0.1)

  return (
    <section className="hero" id="top">
      <div className="hero-inner fade-up" ref={ref}>
        <img className="hero-avatar" src={avatar} alt={profile.nameZh} />
        <div className="hero-bio">
          <div className="hero-name-zh">{profile.nameZh}</div>
          <div className="hero-name-en">{profile.nameEn}</div>
          <div className="hero-affil-zh">{profile.affiliationZh}</div>
          <div className="hero-affil-en">{profile.affiliationEn}</div>
          <p className="hero-desc-zh">{profile.bioZh}</p>
          <p className="hero-desc-en">{profile.bioEn}</p>
          <div className="hero-links">
            {profile.email && (
              <a href={`mailto:${profile.email}`} className="hero-link">{profile.email}</a>
            )}
            {profile.github && (
              <a href={profile.github} className="hero-link" target="_blank" rel="noreferrer">GitHub</a>
            )}
            {profile.scholar && (
              <a href={profile.scholar} className="hero-link" target="_blank" rel="noreferrer">Google Scholar</a>
            )}
            {profile.cv && (
              <a href={profile.cv} className="hero-btn" download>↓ CV</a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
