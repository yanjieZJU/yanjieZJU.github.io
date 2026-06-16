import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '..', 'pdf-exports')

const PROJECTS = ['diamaid', 'ergokare', 'driving-assistant', 'xingshixian', 'hci-llm']
const BASE_URL = 'http://localhost:5173'

// Slide pixel dimensions (16:9)
const W = 1280, H = 720
// PDF page size in mm (matches W×H at 96 dpi)
const W_MM = '338.67mm', H_MM = '190.5mm'

/* ─────────────────────────────────────────────
   Core: restructure the live DOM into slide divs
   ───────────────────────────────────────────── */
async function buildSlides(page) {
  await page.evaluate((W, H) => {
    const PAD = { t: 52, r: 64, b: 44, l: 64 }
    const INNER_W = W - PAD.l - PAD.r  // 1152
    const INNER_H = H - PAD.t - PAD.b  // 624

    // ── helpers ──
    const mkSlide = (css = '') => {
      const d = document.createElement('div')
      d.className = 'pdf-slide'
      d.style.cssText = `width:${W}px;height:${H}px;box-sizing:border-box;`
        + `padding:${PAD.t}px ${PAD.r}px ${PAD.b}px ${PAD.l}px;`
        + `overflow:hidden;position:relative;`
        + `page-break-after:always;page-break-inside:avoid;background:#fff;${css}`
      return d
    }

    const addLabel = (slide, txt) => {
      if (!txt) return
      const d = document.createElement('div')
      d.textContent = txt
      d.style.cssText = 'font-size:11px;color:#94a3b8;text-transform:uppercase;'
        + 'letter-spacing:1.5px;margin-bottom:14px;font-weight:500;'
      slide.insertBefore(d, slide.firstChild)
    }

    const addPageNum = (slide, n, total) => {
      const d = document.createElement('div')
      d.textContent = `${n} / ${total}`
      d.style.cssText = 'position:absolute;bottom:16px;right:28px;font-size:11px;color:#cbd5e1;'
      slide.appendChild(d)
    }

    const isImgBlock = el => {
      if (!el) return false
      if (el.tagName === 'IMG') return true
      return el.tagName === 'P' && el.childElementCount === 1
        && el.children[0]?.tagName === 'IMG'
    }

    const isShortTitle = el =>
      el?.tagName === 'P' && el.textContent.trim().length < 40
      && (el.querySelector('strong') || el.querySelector('b'))

    // ── remove site chrome ──
    document.querySelectorAll('header, footer, nav, .back-link').forEach(e => e.remove())

    const detail = document.querySelector('.proj-detail')
    const content = detail?.querySelector('.proj-content')
    if (!detail || !content) return

    const slides = []

    // ═══════ COVER SLIDE ═══════
    const cover = mkSlide(
      'display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;'
    )
    const tZh = detail.querySelector('.proj-title-zh')
    const tEn = detail.querySelector('.proj-title-en')
    if (tZh) {
      tZh.style.cssText = 'font-size:34px;font-weight:700;color:#1a365d;margin:0 0 10px;'
      cover.appendChild(tZh)
    }
    if (tEn) {
      tEn.style.cssText = 'font-size:15px;color:#718096;margin:0 0 32px;font-weight:400;'
      cover.appendChild(tEn)
    }
    // Grab summary paragraph (first <p> without img)
    for (const p of content.querySelectorAll(':scope > p')) {
      if (!p.querySelector('img')) {
        p.style.cssText = 'font-size:14px;line-height:1.8;color:#4a5568;'
          + 'max-width:860px;text-align:center;margin:0 auto;'
        cover.appendChild(p)
        break
      }
    }
    slides.push(cover)

    // ═══════ CONTENT SLIDES ═══════
    const kids = Array.from(content.children)
    let sec = ''   // current h2 section name
    let cur = null // current accumulating slide

    const flush = () => {
      if (!cur) return
      // skip if slide only contains a section label and nothing else
      const meaningful = Array.from(cur.children).filter(
        c => !c.dataset?.slideLabel
      )
      if (meaningful.length > 0) slides.push(cur)
      cur = null
    }

    for (let i = 0; i < kids.length; i++) {
      const el = kids[i]
      if (el.parentNode !== content) continue // already moved
      const tag = el.tagName?.toLowerCase()
      if (!tag || tag === 'hr') continue

      const isH2 = tag === 'h2'
      const isChart = el.classList?.contains('chart-block')
      const isImg = isImgBlock(el)

      // ── H2: section start ──
      if (isH2) {
        flush()
        sec = el.textContent.trim()
        cur = mkSlide()
        el.style.cssText = 'font-size:24px;font-weight:700;color:#1a365d;'
          + 'margin:0 0 20px;padding-bottom:10px;border-bottom:2px solid #e2e8f0;'
        cur.appendChild(el)

        // Peek: if next element is a chart, group h2 + chart on same slide
        const next = kids[i + 1]
        if (next?.classList?.contains('chart-block') && next.parentNode === content) {
          next.style.cssText += ';width:100%;max-height:540px;overflow:hidden;'
          cur.appendChild(next)
          i++
          flush()
        }
        continue
      }

      // ── Chart: own slide (with section label) ──
      if (isChart) {
        flush()
        const s = mkSlide()
        addLabel(s, sec)
        el.style.cssText += ';width:100%;max-height:' + (INNER_H - 30) + 'px;overflow:hidden;'
        s.appendChild(el)
        slides.push(s)
        continue
      }

      // ── Standalone image: own slide ──
      if (isImg) {
        // If current slide's last child is a short bold title, pull it onto the image slide
        let titleEl = null
        if (cur) {
          const last = cur.lastElementChild
          if (isShortTitle(last)) {
            titleEl = last
            cur.removeChild(titleEl)
          }
        }
        flush()

        const s = mkSlide(
          'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        )
        if (titleEl) {
          titleEl.style.cssText = 'font-size:16px;font-weight:600;color:#2d3748;'
            + 'margin-bottom:14px;text-align:center;'
          s.appendChild(titleEl)
        }
        addLabel(s, sec)

        const img = el.tagName === 'IMG' ? el : el.querySelector('img')
        if (img) {
          const maxH = titleEl ? INNER_H - 60 : INNER_H - 30
          img.style.cssText = `max-width:${INNER_W}px;max-height:${maxH}px;`
            + 'object-fit:contain;display:block;'
        }
        el.style.textAlign = 'center'
        s.appendChild(el)
        slides.push(s)
        continue
      }

      // ── Regular content: accumulate on current slide ──
      if (!cur) {
        cur = mkSlide()
        const lbl = document.createElement('div')
        lbl.textContent = sec
        lbl.dataset.slideLabel = '1'
        lbl.style.cssText = 'font-size:11px;color:#94a3b8;text-transform:uppercase;'
          + 'letter-spacing:1.5px;margin-bottom:14px;font-weight:500;'
        if (sec) cur.appendChild(lbl)
      }

      if (tag === 'h3') {
        el.style.cssText = 'font-size:18px;font-weight:600;color:#2d3748;margin:14px 0 6px;'
      } else if (el.classList?.contains('card-block')) {
        el.style.cssText += ';margin:10px 0;font-size:13px;'
      } else {
        el.style.cssText += ';font-size:13px;line-height:1.7;margin:5px 0;word-break:break-word;'
      }
      cur.appendChild(el)
    }

    flush()

    // ── Page numbers ──
    const total = slides.length
    slides.forEach((s, i) => addPageNum(s, i + 1, total))

    // ── Replace body ──
    document.body.innerHTML = ''
    document.body.style.cssText = 'margin:0;padding:0;background:#fff;'
      + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans SC",sans-serif;'
    const wrap = document.createElement('div')
    slides.forEach(s => wrap.appendChild(s))
    document.body.appendChild(wrap)

  }, W, H)
}

/* ─────────────────────────────────────────────
   Export one project
   ───────────────────────────────────────────── */
async function exportProject(page, slug) {
  console.log(`\n  → ${slug}`)
  await page.goto(`${BASE_URL}/#/projects/${slug}`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  })
  await page.waitForSelector('.proj-title-zh', { timeout: 10000 })
  // Wait for React charts & KG force simulation to stabilize
  await new Promise(r => setTimeout(r, 3000))

  await buildSlides(page)
  await new Promise(r => setTimeout(r, 500))

  const out = path.join(OUTPUT_DIR, `${slug}-slides.pdf`)
  await page.pdf({
    path: out,
    width: W_MM,
    height: H_MM,
    printBackground: true,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    preferCSSPageSize: true,
  })
  console.log(`    ✓ ${slug}-slides.pdf`)
}

/* ─────────────────────────────────────────────
   Main
   ───────────────────────────────────────────── */
async function main() {
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true })

  // Allow single project: node export-slides.mjs diamaid
  const target = process.argv[2]
  const projects = target ? [target] : PROJECTS

  console.log('Launching browser (16:9 slide export)...')
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H })

  for (const slug of projects) {
    await exportProject(page, slug)
  }

  await browser.close()
  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
