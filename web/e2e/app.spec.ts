import { expect, test, type Page } from '@playwright/test'
import {
  NESTED_DIR_NAME,
  NESTED_FILE_NAME,
  PRIMARY_IMAGE_FILE_NAME,
  SECONDARY_IMAGE_FILE_NAME,
  TEST_ROOT_LABEL,
  TOTAL_INDEXED_ENTRIES,
  UNIQUE_FILE_NAME,
} from './fixtures'
import { waitForIndexedFixture } from './helpers'

function visibleEntry(page: Page, name: string) {
  return page
    .locator('[data-testid="entry-table-item"]:visible, [data-testid="entry-grid-item"]:visible')
    .filter({ hasText: name })
    .first()
}

function visibleFileBrowserItem(page: Page, name: string) {
  return page
    .locator('[data-testid="file-browser-item-button"]:visible')
    .filter({ hasText: name })
    .first()
}

test.beforeAll(async ({ request }) => {
  await waitForIndexedFixture(request)
})

test('uncategorized renders every indexed entry instead of truncating at 50', async ({ page }) => {
  await page.goto('/uncategorized')

  await expect(page.getByRole('heading', { name: 'Uncategorized' })).toBeVisible()
  await expect(page.getByText(`${TOTAL_INDEXED_ENTRIES} files without categories`)).toBeVisible()
  await expect(page.locator('[data-testid="entry-grid-item"]')).toHaveCount(TOTAL_INDEXED_ENTRIES)
})

test('files browser can navigate into a directory and open the entry detail sheet', async ({ page }) => {
  await page.goto('/files')

  await page
    .locator('[data-testid="file-browser-root-button"]')
    .filter({ hasText: TEST_ROOT_LABEL })
    .click()
  await expect(visibleFileBrowserItem(page, UNIQUE_FILE_NAME)).toBeVisible()

  await visibleFileBrowserItem(page, NESTED_DIR_NAME).click()
  await expect(visibleFileBrowserItem(page, NESTED_FILE_NAME)).toBeVisible()

  await visibleFileBrowserItem(page, NESTED_FILE_NAME).click()
  await expect(page.getByRole('dialog')).toContainText(NESTED_FILE_NAME)
})

test('header search routes to the search page and returns the matching file', async ({ page }) => {
  await page.goto('/home')

  await page.getByPlaceholder('Search files...').fill('needle-target')
  await page.getByPlaceholder('Search files...').press('Enter')

  await expect(page).toHaveURL(/\/search\?q=needle-target/)
  await expect(page.getByText(UNIQUE_FILE_NAME)).toBeVisible()
  await expect(page.locator('[data-testid="entry-grid-item"]')).toHaveCount(1)
})

test.describe('mobile navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only navigation coverage')

  test('drawer opens and can route to Files', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeVisible()

    await page.getByRole('link', { name: 'Files' }).click()
    await expect(page).toHaveURL(/\/files$/)
    await expect(page.getByRole('heading', { name: 'Files', exact: true })).toBeVisible()
  })

  test('lightbox queue opens and switches media on mobile', async ({ page }) => {
    await page.goto('/recent')

    await visibleEntry(page, PRIMARY_IMAGE_FILE_NAME).click()
    await expect(page.locator('[data-testid="lightbox-title"]')).toHaveText(PRIMARY_IMAGE_FILE_NAME)
    await expect(page.locator('[data-testid="lightbox-media-image"]')).toHaveAttribute('alt', PRIMARY_IMAGE_FILE_NAME)

    await page.locator('[data-testid="lightbox-open-queue"]').click()
    await expect(page.locator('[data-testid="lightbox-mobile-queue"]')).toBeVisible()

    await page
      .locator('[data-testid="lightbox-queue-item"]')
      .filter({ hasText: SECONDARY_IMAGE_FILE_NAME })
      .click()

    await expect(page.locator('[data-testid="lightbox-mobile-queue"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="lightbox-title"]')).toHaveText(SECONDARY_IMAGE_FILE_NAME)
    await expect(page.locator('[data-testid="lightbox-media-image"]')).toHaveAttribute('alt', SECONDARY_IMAGE_FILE_NAME)
  })
})
