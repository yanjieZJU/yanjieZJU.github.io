import profile from '../../content/profile.js'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        © 2026 {profile.nameZh} · {profile.nameEn}
        {' · '}Build with Claude Code
      </p>
    </footer>
  )
}
