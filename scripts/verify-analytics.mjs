// 埋点验证脚本：起 dev server 后运行 `node scripts/verify-analytics.mjs`
// 用 puppeteer 真实点击页面（导航/卡片/社交按钮），抓取发往 cloud.umami.is 的请求。
// 若本机网络加载不了云端脚本，会退回用 window.umami stub 验证埋点调用逻辑。
import puppeteer from 'puppeteer'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const step = msg => console.log(`\n[step] ${msg}`)

const networkLog = []
const checks = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({ protocolTimeout: 45000, args: ['--no-proxy-server'] })
let page
try {
  page = await browser.newPage()
  page.setDefaultTimeout(15000)

  // 兜底 stub：真实 tracker 是 "window.umami 不存在才绑定"，预装会挡掉真脚本，
  // 因此只在等待 8s 后仍未出现真实 API 时才装，用于验证我们的调用逻辑。
  const installStubIfMissing = () =>
    page.evaluate(() => {
      window.__umamiStubCalls = window.__umamiStubCalls ?? []
      if (typeof window.umami?.track !== 'function') {
        window.umami = {
          track(a) {
            if (typeof a === 'function') {
              window.__umamiStubCalls.push(a({
                website: 'stub', hostname: location.hostname, language: 'stub',
                referrer: '', screen: 'stub', title: document.title, url: location.pathname,
              }))
            } else {
              window.__umamiStubCalls.push({ name: a })
            }
          },
        }
      }
    })

  const isUmamiUrl = u => u.includes('cloud.umami.is') || u.includes('gateway.umami.is')
  const note = req => {
    if (!isUmamiUrl(req.url())) return
    const body = req.method() === 'POST' ? req.postData() : ''
    networkLog.push(`${req.method()} ${req.url()}${body ? `\n    body: ${body}` : ''}`)
  }
  page.on('request', note)
  page.on('requestfailed', req => {
    if (isUmamiUrl(req.url()))
      networkLog.push(`FAILED ${req.url()} (${req.failure()?.errorText})`)
  })

  const evalClick = (selector) =>
    page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error(`selector not found: ${selector}`)
      el.click()
    }, selector)

  const evalClickByText = (selector, text) =>
    page.evaluate((selector, text) => {
      const el = [...document.querySelectorAll(selector)].find(e => e.textContent.trim() === text)
      if (!el) throw new Error(`no "${text}" in ${selector}`)
      el.click()
    }, selector, text)

  // 1. 首页初始 pageview（等足 8s：国内直连脚本握手 5s+，whenReady 15s 窗口内补发）
  step('打开首页')
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.hero')
  await sleep(8000)
  await installStubIfMissing()
  const realApi = await page.evaluate(() => typeof window.umami?.track === 'function' && !('__umamiStubCalls' in window && window.umami.track.toString().includes('__umamiStubCalls')))
  const homeTitle = await page.title()
  console.log(`  title: ${homeTitle} / 真实API: ${realApi}`)

  // 2. 点导航 Blog → /blog pageview
  step('点击导航 Blog')
  await evalClickByText('.navbar-links a', 'Blog')
  await page.waitForSelector('.projects-grid')
  await sleep(2500)
  const blogTitle = await page.title()
  console.log(`  title: ${blogTitle}`)

  // 3. 点第一张卡片 → 卡片事件 + 详情页 pageview
  step('点击第一张博客卡片')
  const cardSlug = await page.evaluate(() =>
    document.querySelector('.project-link')?.getAttribute('data-umami-event-slug'))
  console.log(`  slug: ${cardSlug}`)
  await evalClick('.project-link')
  await page.waitForSelector('.proj-title-zh')
  await sleep(2500)

  // 4. 浏览器后退 → popstate 也应发 pageview
  step('浏览器后退')
  await page.goBack({ waitUntil: 'domcontentloaded' })
  await sleep(2500)

  // 5. 回首页点社交按钮：GitHub 图标 + 微信按钮
  step('点击 GitHub 图标 / 微信按钮')
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.hero')
  await sleep(1000)
  await evalClick('a[aria-label="GitHub"]')
  await evalClick('button[aria-label="微信 WeChat"]')
  await sleep(2500)

  const stubCalls = realApi ? [] : await page.evaluate(() => window.__umamiStubCalls ?? [])
  const realLoaded = networkLog.some(l => /^GET .*cloud\.umami\.is.*script\.js/.test(l) && !l.startsWith('FAILED'))

  // ---- 汇总 ----
  console.log('\n=== 发往 cloud.umami.is 的请求 ===')
  console.log(networkLog.length ? networkLog.join('\n') : '(无)')

  const realSent = networkLog.filter(l => l.includes('/api/send'))
  console.log(`\n=== stub 调用（仅云端脚本未加载时有内容，共 ${stubCalls.length} 条） ===`)
  stubCalls.forEach(c => console.log(JSON.stringify(c)))

  // 数据源：真实 POST body 或 stub 记录，二选一
  const sent = realSent.length
    ? realSent.map(l => {
        try {
          const body = JSON.parse(l.split('\n    body: ')[1])
          return typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload ?? body
        } catch { return {} }
      })
    : stubCalls

  const urls = sent.map(s => s.url)
  const events = sent.filter(s => s.name).map(s => ({ name: s.name, data: s.data }))
  console.log(`\n=== 解析出的 pageview urls: ${JSON.stringify(urls)}`)
  console.log(`=== 解析出的 events: ${JSON.stringify(events)}`)

  console.log('\n=== 断言 ===')
  check('云端 script.js 加载', realLoaded, realLoaded ? '' : '本机网络可能拦截了 cloud.umami.is')
  check('真实 API 生效（未被 stub 兜底）', realApi)
  check('真实请求发出', realSent.length > 0, realSent.length ? `${realSent.length} 条 /api/send` : '走了 stub 路径')
  check('首页 pageview url="/" + 标题', urls.includes('/') && homeTitle.includes('首页'), `"${homeTitle}"`)
  check('导航到 /blog 的 pageview', urls.includes('/blog'), blogTitle)
  check('卡片点击 pageview /blog/<slug>', urls.some(u => u === `/blog/${cardSlug}`), `slug=${cardSlug}`)
  const cardClick = events.find(e => e.name === 'card_click')
  check('card_click 事件（type/slug）', !!cardClick && cardClick.data?.type === 'blog' && cardClick.data?.slug === cardSlug, JSON.stringify(cardClick?.data ?? null))
  const socials = events.filter(e => e.name === 'social_click').map(e => e.data?.network)
  check('social_click github + wechat', socials.includes('github') && socials.includes('wechat'), JSON.stringify(socials))
  check('后退(popstate)再发一条 pageview', urls.filter(u => u === '/blog').length >= 2)
} catch (err) {
  console.error('\n[error]', err.message)
} finally {
  await browser.close().catch(() => {})
}

const failed = checks.filter(c => !c.ok)
console.log(`\n结果：${checks.length - failed.length}/${checks.length} 通过`)
process.exit(failed.length ? 1 : 0)
