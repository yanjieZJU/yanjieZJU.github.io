import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Navbar.css'

const links = [
  { label: 'About', targetId: 'top' },
  { label: 'Education', targetId: 'education' },
  { label: 'Works', targetId: 'projects' },
  { label: 'Skills', targetId: 'skills' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToSection = (targetId) => {
    if (targetId === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const el = document.getElementById(targetId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    const targetId = location.state?.scrollTarget
    if (location.pathname === '/' && targetId) {
      window.setTimeout(() => scrollToSection(targetId), 0)
      navigate('/', { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const handleNavigate = (targetId) => (event) => {
    event.preventDefault()
    if (location.pathname === '/') {
      scrollToSection(targetId)
      return
    }
    navigate('/', { state: { scrollTarget: targetId } })
  }

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <a className="navbar-logo" href="/" onClick={handleNavigate('top')}>颜婕 · Yan Jie</a>
      <ul className="navbar-links">
        {links.map(({ label, targetId }) => (
          <li key={targetId}>
            <a href="/" onClick={handleNavigate(targetId)}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
