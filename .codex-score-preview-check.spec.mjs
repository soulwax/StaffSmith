import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from 'playwright/test.js'

const artifactsDir = path.resolve('.codex-artifacts')

test('score preview controls render and respond', async ({ page }) => {
  const consoleErrors = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await fs.mkdir(artifactsDir, { recursive: true })

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

  await expect(page.getByRole('heading', { name: 'Staffsmith' })).toBeVisible()
  await expect(page.locator('.vite-error-overlay')).toHaveCount(0)
  await expect(page.getByLabel('Adjust note preview size')).toBeVisible()
  await expect(page.getByLabel('Adjust spacing between notation lines')).toBeVisible()
  await expect(page.getByLabel('Set measures per notation line')).toBeVisible()

  const scoreCard = page.locator('.score-preview-card')
  await scoreCard.screenshot({ path: path.join(artifactsDir, 'score-preview-before.png') })

  await page.getByLabel('Adjust note preview size').evaluate((element) => {
    const input = element
    input.value = '130'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByLabel('Adjust spacing between notation lines').evaluate((element) => {
    const input = element
    input.value = '150'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByLabel('Set measures per notation line').selectOption('2')
  await page.getByLabel('Title').uncheck()
  await page.waitForTimeout(1200)

  await expect(page.getByText('130%')).toBeVisible()
  await expect(page.getByText('150%')).toBeVisible()
  await expect(page.locator('.score-title-block')).toHaveCount(0)

  await scoreCard.screenshot({ path: path.join(artifactsDir, 'score-preview-after.png') })

  const generateButton = page.getByRole('button', { name: 'Generate' })
  const generateButtonStyles = await generateButton.evaluate((button) => {
    const styles = window.getComputedStyle(button)
    return {
      backgroundColor: styles.backgroundColor,
      backgroundImage: styles.backgroundImage,
      borderColor: styles.borderColor,
      color: styles.color,
    }
  })

  console.log(JSON.stringify({
    consoleErrors,
    pageLabel: await page.getByText(/Page \d+ \/ \d+/).innerText(),
    generateButtonStyles,
  }, null, 2))

  expect(consoleErrors).toEqual([])
})
