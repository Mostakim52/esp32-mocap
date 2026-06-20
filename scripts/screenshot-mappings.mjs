import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

const mappings = [
  {
    name: 'current',
    armsOnly: false,
    armSet: (p, r) => [p, 0, r, 'YXZ'],
    legSet: (p, r) => [p, 0, r, 'XZY'],
  },
  {
    name: 'arms-only-current',
    armsOnly: true,
    armSet: (p, r) => [p, 0, r, 'YXZ'],
  },
  {
    name: 'arms-rollX-pitchZ',
    armsOnly: true,
    armSet: (p, r) => [r, 0, p, 'YXZ'],
  },
  {
    name: 'arms-rollX-negPitchZ',
    armsOnly: true,
    armSet: (p, r) => [r, 0, -p, 'YXZ'],
  },
  {
    name: 'arms-negRollX-pitchZ',
    armsOnly: true,
    armSet: (p, r) => [-r, 0, p, 'YXZ'],
  },
]

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 900, height: 700 })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 })
await page.waitForTimeout(2500)

for (const mapping of mappings) {
  await page.evaluate((cfg) => {
    window.__mocapTest = cfg
  }, mapping)

  await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type=range]')
    inputs[0].value = '35'
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    inputs[1].value = '25'
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
  })

  await page.waitForTimeout(800)
  await page.screenshot({ path: `test-output/map-${mapping.name}.png` })
  console.log('saved', mapping.name)
}

await browser.close()
