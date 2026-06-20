import puppeteer from 'puppeteer'

const chromePath =
  process.env.CHROME_BIN ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
  executablePath: chromePath,
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
await page.screenshot({ path: 'test-output/fixed-rest.png' })

await page.evaluate(() => {
  const inputs = document.querySelectorAll('input[type=range]')
  inputs[0].value = '35'
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
  inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
  inputs[1].value = '25'
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
  inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 1000))
await page.screenshot({ path: 'test-output/fixed-manual.png' })

await page.locator('button ::-p-text(Idle Motion)').click()
await new Promise((r) => setTimeout(r, 2000))
await page.screenshot({ path: 'test-output/fixed-idle.png' })
await browser.close()
console.log('screenshots saved')
