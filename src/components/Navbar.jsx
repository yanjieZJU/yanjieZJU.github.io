import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import './Navbar.css'

const sectionLinks = [
  { label: 'About', targetId: 'top' },
  { label: 'Education', targetId: 'education' },
]

const routeLinks = [
  { label: 'Works', path: '/works' },
  { label: 'Blog', path: '/blog' },
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

  const handleSectionNavigate = (targetId) => (event) => {
    event.preventDefault()
    if (location.pathname === '/') {
      scrollToSection(targetId)
      return
    }
    navigate('/', { state: { scrollTarget: targetId } })
  }

  const isRouteActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)

  return (
    <nav className={`navbar${scrolled || location.pathname !== '/' ? ' scrolled' : ''}`}>
      <a className="navbar-logo" href="/" onClick={handleSectionNavigate('top')}>颜婕 · Yan Jie</a>
      <ul className="navbar-links">
        {sectionLinks.map(({ label, targetId }) => (
          <li key={targetId}>
            <a href="/" onClick={handleSectionNavigate(targetId)}>{label}</a>
          </li>
        ))}
        {routeLinks.map(({ label, ...rest }) =>
          rest.path ? (
            <li key={rest.path}>
              <Link to={rest.path} className={isRouteActive(rest.path) ? 'active' : ''}>{label}</Link>
            </li>
          ) : (
            <li key={rest.targetId}>
              <a href="/" onClick={handleSectionNavigate(rest.targetId)}>{label}</a>
            </li>
          )
        )}
      </ul>
    </nav>
  )
}
