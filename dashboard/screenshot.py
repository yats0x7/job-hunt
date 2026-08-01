import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1440, "height": 900})
        await page.goto("http://localhost:3000")
        await page.wait_for_timeout(3000)
        await page.screenshot(path="dashboard_real.png")
        await page.click("text=Algolia")
        await page.wait_for_timeout(3000)
        await page.screenshot(path="detail_real.png")
        await browser.close()

asyncio.run(main())
