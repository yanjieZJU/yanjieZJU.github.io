import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '..', 'pdf-exports')

const PROJECTS = [
  'diamaid',
  'ergokare',
  'driving-assistant',
  'xingshixian',
  'hci-llm',
]

const BASE_URL = 'http://localhost:5173'

async function exportProject(page, slug) {
  const url = `${BASE_URL}/#/projects/${slug}`
  console.log(`  → ${url}`)

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })

  // Wait for the project title to appear (confirms React has rendered)
  await page.waitForSelector('.proj-title-zh', { timeout: 10000 })

  // Give images extra time to load
  await new Promise(r => setTimeout(r, 1500))

  const outPath = path.join(OUTPUT_DIR, `${slug}.pdf`)
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
  })

  console.log(`  ✓ Saved: pdf-exports/${slug}.pdf`)
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
  }

  console.log('Launching browser...')
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  console.log(`\nExporting ${PROJECTS.length} projects...\n`)

  for (const slug of PROJECTS) {
    await exportProject(page, slug)
  }

  await browser.close()
  console.log('\nDone. PDFs saved to pdf-exports/')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
