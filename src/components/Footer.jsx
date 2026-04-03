import profile from '../../content/profile.js'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        © 2026 {profile.nameZh} · {profile.nameEn}
        {profile.github && (
          <>{' · '}<a href={profile.github} target="_blank" rel="noreferrer">GitHub</a></>
        )}
        {profile.email && (
          <>{' · '}<a href={`mailto:${profile.email}`}>{profile.email}</a></>
        )}
      </p>
    </footer>
  )
}
