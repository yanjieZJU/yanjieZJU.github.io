// src/components/Navbar.jsx
import { useEffect, useState } from 'react'
import './Navbar.css'

const links = [
  { label: '教育经历', href: '#education' },
  { label: '项目经历', href: '#projects' },
  { label: '个人技能', href: '#skills' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <a className="navbar-logo" href="#top">颜婕</a>
      <ul className="navbar-links">
        {links.map(({ label, href }) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
