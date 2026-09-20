import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageview, initClickTracking } from '../lib/analytics'

const SITE_SUFFIX = ' | 颜婕 · Yan Jie'

// 不渲染任何内容。在 App.jsx 的 <HashRouter> 内挂载一次：
// 路由变化（含浏览器前进/后退）时发送虚拟页面浏览，并同步浏览器标签页标题。
export default function RouteTracker({ titles = {} }) {
  const location = useLocation()
  const lastPath = useRef(null)

  useEffect(() => {
    initClickTracking() // 幂等
  }, [])

  useEffect(() => {
    const path = location.pathname
    if (lastPath.current === path) return // 跳过 dev 模式 StrictMode 的 effect 双触发
    lastPath.current = path

    const title = titles[path] ? titles[path] + SITE_SUFFIX : document.title
    document.title = title
    trackPageview(path, title)
  }, [location.pathname, titles])

  return null
}
