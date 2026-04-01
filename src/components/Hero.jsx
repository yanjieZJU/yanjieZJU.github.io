// src/components/Hero.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import avatar from '../assets/avatar.svg'
import './Hero.css'

export default function Hero() {
  const ref = useScrollAnimation(0.1)

  return (
    <section className="hero" id="top">
      <div className="hero-inner fade-up" ref={ref}>
        <div className="hero-text">
          <p className="hero-label">人与 AI 交互设计研究者</p>
          <h1 className="hero-name">颜婕</h1>
          <p className="hero-subtitle">浙江大学 · 设计学 硕士（保研）</p>
          <p className="hero-meta">研究方向：人与AI交互，关注大模型在设计支持、体验评估与智能交互中的应用</p>
          <div className="hero-links">
            <a
              className="hero-btn hero-btn-primary"
              href="mailto:yanjie02@zju.edu.cn"
            >
              ✉ 联系我
            </a>
            <a
              className="hero-btn hero-btn-secondary"
              href="https://github.com/yanjieZJU"
              target="_blank"
              rel="noreferrer"
            >
              GitHub →
            </a>
          </div>
        </div>
        <img
          className="hero-avatar"
          src={avatar}
          alt="颜婕头像"
        />
      </div>
    </section>
  )
}
