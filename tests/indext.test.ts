import { setup, createPage } from '@nuxt/test-utils/e2e'
import { describe, it, expect } from 'vitest'

describe('index', async () => {

    await setup({
        // test context options
        browser: true
    })

    it('renders', async () => {

        const page = await createPage('/org/foo')
        // you can access all the Playwright APIs from the `page` variable
        expect(page).toBeDefined()
        expect(await page.getByRole('heading').isVisible()).toBe(true)
    })
})

