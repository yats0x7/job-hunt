import asyncio
import logging
from playwright.async_api import async_playwright, BrowserContext
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from pipeline.storage.models import Company, Founder
from pipeline.storage.db import Database
from pipeline.enrichment.llm_fallback import extract_college_from_bio
from pipeline.enrichment.photo_url import normalize_photo_url

logger = logging.getLogger(__name__)

# Module-level DB instance for caching
db = Database()

# Robust selectors for YCombinator company pages
FOUNDER_SECTION_SELECTOR = "div.ycdc-card-new" 
FOUNDER_CARD_SELECTOR = "div.ycdc-card-new"
NAME_SELECTOR = ".font-bold"
PHOTO_SELECTOR = "img.h-full.w-full.object-cover"
LINKEDIN_SELECTOR = "a[href*='linkedin.com']"
BIO_SELECTOR = "p.prose, p"


class FounderEnricher:
    """
    Enriches founder objects with additional data by scraping the YC company page
    using Playwright to bypass 403 errors.
    """
    
    async def enrich_batch(self, companies: list[Company]) -> list[Company]:
        """
        Owns the browser lifecycle. Creates browser ONCE, runs all enrichment,
        closes browser. Returns list same length as input.
        """
        hiring = [c for c in companies if c.is_hiring]
        non_hiring = [c for c in companies if not c.is_hiring]
        # non_hiring companies pass through unchanged: founders=[], job_board=None

        # Ensure DB is connected
        if not db._conn:
            db.connect()

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                           'AppleWebKit/537.36 (KHTML, like Gecko) '
                           'Chrome/120.0.0.0 Safari/537.36',
                viewport={'width': 1280, 'height': 800},
                locale='en-US'
            )

            sem = asyncio.Semaphore(3)  # max 3 concurrent pages

            async def enrich_one(company: Company) -> Company:
                async with sem:
                    # Check SQLite cache first
                    cached = db.get_founders_cached(company.slug, max_age_days=7)
                    if cached:
                        company.founders = cached
                        return company

                    company.founders = await self._extract_founders(company, context)
                    await asyncio.sleep(1.0)  # inside sem, after work — rate limiting
                    return company

            enriched = await asyncio.gather(*[enrich_one(c) for c in hiring])
            await context.close()
            await browser.close()

        return list(enriched) + non_hiring
        # NOTE: return list must be same length as input companies list

    async def _extract_founders(self, company: Company, context: BrowserContext) -> list[Founder]:
        page = await context.new_page()
        try:
            try:
                await page.goto(
                    f'https://www.ycombinator.com/companies/{company.slug}',
                    wait_until='domcontentloaded',
                    timeout=12000
                )
            except Exception as e:
                logger.warning(f'Navigation failed for {company.slug}: {e}')
                return []

            try:
                await page.wait_for_selector('div.ycdc-card-new', timeout=8000)
            except Exception:
                logger.warning(f'Founder section not found: {company.slug}')
                return []

            # Strategy: find individual founder photo containers
            # Each founder has exactly one: div.aspect-square.h-20
            # This is the most reliable per-founder delimiter on the page
            founder_photo_containers = await page.query_selector_all(
                'div.aspect-square.h-20.shrink-0'
            )

            if not founder_photo_containers:
                logger.warning(f'No founder photo containers found: {company.slug}')
                return []

            founders = []
            for container in founder_photo_containers:
                try:
                    # Photo is the img inside this container
                    photo_el = await container.query_selector('img')
                    raw_photo = await photo_el.get_attribute('src') if photo_el else None
                    photo_url = normalize_photo_url(raw_photo)

                    # Name and bio are in the sibling div: div.min-w-0.flex-1
                    # Use XPath to get the next sibling
                    parent = await container.evaluate_handle('el => el.parentElement')
                    text_div = await parent.query_selector('div.min-w-0.flex-1')

                    if not text_div:
                        continue

                    full_text = await text_div.inner_text()
                    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

                    if not lines:
                        continue

                    name = lines[0]  # first line is always the name
                    # title is lines[1] if present
                    bio_text = ' '.join(lines[2:]) if len(lines) > 2 else None

                    # Validate name
                    if not _is_valid_founder_name(name, company):
                        continue

                    # LinkedIn is in the parent card, not the text div
                    # Search upward to the ycdc-card-new level
                    card = await container.evaluate_handle(
                        'el => el.closest("div.ycdc-card-new")'
                    )
                    linkedin_el = await card.query_selector('a[href*="linkedin.com"]')
                    linkedin_url = await linkedin_el.get_attribute('href') if linkedin_el else None

                    college = await asyncio.to_thread(
                        extract_college_from_bio, bio_text
                    ) if bio_text else None

                    founders.append(Founder(
                        name=name,
                        photo_url=photo_url,
                        linkedin_url=linkedin_url,
                        college=college,
                        raw_bio=bio_text
                    ))

                    logger.info(f'  Found founder: {name} (photo: {"yes" if photo_url else "no"})')

                except Exception as e:
                    logger.debug(f'Error on founder container for {company.slug}: {e}')
                    continue

            logger.info(f'{company.name}: extracted {len(founders)} founders')
            return founders

        except Exception as e:
            logger.warning(f'Founder extraction failed for {company.slug}: {e}')
            return []
        finally:
            await page.close()


def _is_valid_founder_name(name: str, company) -> bool:
    """
    Returns False if the extracted text is clearly not a human name.
    Catches company description bleed and other parsing artifacts.
    """
    if not name or len(name.strip()) < 2:
        return False
    # Too many words = description bleed (real names are 2-4 words)
    if len(name.split()) > 5:
        return False
    # Punctuation = sentence/description, not a name
    if any(char in name for char in ['.', ',', '!', '?', ':', '"', '(']):
        return False
    # Matches company name exactly
    if name.strip().lower() == company.name.strip().lower():
        return False
    # Matches company description
    if company.description and name.strip().lower() == company.description.strip().lower():
        return False
    return True
