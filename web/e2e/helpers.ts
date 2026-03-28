import { expect, type APIRequestContext } from '@playwright/test'
import { TOTAL_INDEXED_ENTRIES } from './fixtures'

export async function waitForIndexedFixture(request: APIRequestContext) {
  await expect
    .poll(async () => {
      const response = await request.get(`/api/recent?limit=0`)
      if (!response.ok()) {
        return -1
      }
      const entries = await response.json()
      return Array.isArray(entries) ? entries.length : -1
    }, {
      message: 'fixture root should be fully indexed before the tests start',
      timeout: 30_000,
    })
    .toBe(TOTAL_INDEXED_ENTRIES)
}
