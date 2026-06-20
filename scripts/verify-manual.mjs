import puppeteer from 'puppeteer'

function setSlider(page, index, value) {
  return page.evaluate((idx, val) => {
    const input = document.querySelectorAll('input[type=range]')[idx]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, String(val))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, index, value)
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))

await setSlider(page, 0, 35)
await setSlider(page, 1, 25)
await new Promise((r) => setTimeout(r, 1000))
await page.screenshot({ path: 'test-output/fixed-manual-35-25.png' })

const values = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input[type=range]')].map((i) => i.value)
  const tracks = [...document.querySelectorAll('.font-mono.text-lg')].map((el) => el.textContent)
  return { inputs, tracks }
})
console.log(values)
await browser.close()
