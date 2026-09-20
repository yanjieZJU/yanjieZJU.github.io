// Umami Cloud 埋点工具（脚本在 index.html 中以 data-auto-track="false" 加载）。
// 说明：Umami 自带的 data-umami-event 点击监听会随 auto-track 一起关闭，且其原生
// 处理器对站内链接会 preventDefault + 等待请求完成再整页跳转，与 React Router 冲突，
// 因此这里自己实现同一套属性契约：fire-and-forget，绝不阻塞导航。

const isReady = () => typeof window.umami?.track === 'function'

// async 云端脚本可能晚于首次调用才加载（国内直连 cloud.umami.is 握手常需 5s+，
// 故重试窗口给到 15s；广告拦截/不可达时最终静默放弃，对站点零影响）。
function whenReady(fn, attempts = 30) {
  if (isReady()) { fn(); return }
  if (attempts <= 0) return
  setTimeout(() => whenReady(fn, attempts - 1), 500)
}

// HashRouter 把路由放在 location.hash：'#/blog/foo' -> '/blog/foo'
export function currentPath() {
  return window.location.hash.replace(/^#/, '') || '/'
}

export function trackPageview(path = currentPath(), title) {
  whenReady(() => {
    window.umami.track(props => ({ ...props, url: path, ...(title && { title }) }))
  })
}

export function trackEvent(name, data) {
  whenReady(() => {
    // 函数形式可为事件附带干净的路由 url（否则 HashRouter 下永远是 '/'）
    window.umami.track(props => ({ ...props, url: currentPath(), name, data }))
  })
}

// data-umami-event 属性的委托点击监听（Umami 的属性契约）：
//   <任意元素 data-umami-event="事件名" data-umami-event-属性名="值">
// 对 <a>、<button> 等均生效；捕获阶段监听 + 不 preventDefault，导航零延迟。
const EVENT_ATTR = 'data-umami-event'
const PROP_ATTR = /^data-umami-event-([\w-]+)$/
let clickTrackingReady = false

export function initClickTracking() {
  if (clickTrackingReady) return
  clickTrackingReady = true
  document.addEventListener('click', e => {
    const el = e.target.closest?.(`[${EVENT_ATTR}]`)
    if (!el) return
    const name = el.getAttribute(EVENT_ATTR)
    if (!name) return
    const data = {}
    for (const attr of el.getAttributeNames()) {
      const m = attr.match(PROP_ATTR)
      if (m) data[m[1]] = el.getAttribute(attr)
    }
    trackEvent(name, data)
  }, true)
}
