import { useEffect, useState } from 'react'
import './Navbar.css'

const links = [
  { label: 'About', href: '#top' },
  { label: 'Education', href: '#education' },
  { label: 'Works', href: '#projects' },
  { label: 'Skills', href: '#skills' },
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
      <a className="navbar-logo" href="#top">颜婕 · Yanjie</a>
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
