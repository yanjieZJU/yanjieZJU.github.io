import { useState } from 'react'
import useScrollAnimation from '../hooks/useScrollAnimation'
import avatar from '../assets/avatar.png'
import qrcode from '../assets/qrcode.jpg'
import profile from '../../content/profile.js'
import './Hero.css'

const IconEmail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)

const IconGitHub = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z"/>
  </svg>
)

const IconScholar = () => (
  <svg viewBox="0 0 512 512" fill="currentColor" width="18" height="18" aria-hidden="true">
    <path d="M256 411.12L0 202.667 256 0l256 202.667z"/>
    <path d="M256 411.12l-192-148.453v143.12C64 464.414 153.781 512 256 512s192-47.586 192-106.211V262.667z"/>
    <path d="M453.333 202.667L512 176l-256-176L0 176l58.667 26.667v196.266l42.667 32V229.333l153.6 118.054 198.4-144.72z"/>
  </svg>
)

const IconWeChat = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.431-1.185 3.319-1.698 5.145-1.528-.459-3.61-4.146-6.308-8.378-6.308zM6.133 6.17a1.43 1.43 0 1 1 0 2.864 1.43 1.43 0 0 1 0-2.864zm5.209 0a1.43 1.43 0 1 1 0 2.864 1.43 1.43 0 0 1 0-2.864zm5.19 3.466c-2.815 0-5.343 1.797-5.343 4.213 0 2.354 2.494 4.21 5.343 4.21a7.61 7.61 0 0 0 2.115-.298.796.796 0 0 1 .65.086l1.419.832a.284.284 0 0 0 .15.046.252.252 0 0 0 .252-.254c0-.06-.024-.124-.04-.185l-.293-1.113a.524.524 0 0 1 .19-.585c1.398-1.073 2.224-2.543 2.224-4.138 0-2.416-2.527-4.213-5.343-4.213zm-1.966 2.2a1.223 1.223 0 1 1 0 2.446 1.223 1.223 0 0 1 0-2.446zm3.844 0a1.223 1.223 0 1 1 0 2.446 1.223 1.223 0 0 1 0-2.446z"/>
  </svg>
)

export default function Hero() {
  const ref = useScrollAnimation(0.1)
  const [wechatOpen, setWechatOpen] = useState(false)

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
              <a href={`mailto:${profile.email}`} className="hero-link hero-link-icon" title={profile.email} aria-label="Email">
                <IconEmail />
              </a>
            )}
            {profile.github && (
              <a href={profile.github} className="hero-link hero-link-icon" target="_blank" rel="noreferrer" title="GitHub" aria-label="GitHub">
                <IconGitHub />
              </a>
            )}
            <button
              type="button"
              className={`hero-link hero-link-icon hero-link-wechat${wechatOpen ? ' is-open' : ''}`}
              title="微信 WeChat"
              aria-label="微信 WeChat"
              aria-expanded={wechatOpen}
              onClick={() => setWechatOpen(v => !v)}
              onBlur={() => setWechatOpen(false)}
            >
              <IconWeChat />
              <span className="wechat-popover">
                <img src={qrcode} alt="微信二维码 WeChat QR code" />
                <span className="wechat-popover-label">微信 · WeChat</span>
              </span>
            </button>
            {profile.scholar && (
              <a href={profile.scholar} className="hero-link hero-link-icon" target="_blank" rel="noreferrer" title="Google Scholar" aria-label="Google Scholar">
                <IconScholar />
              </a>
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
