from pipeline.scrapers.base import VCSource
from pipeline.storage.models import Company, Founder
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

class AntlerSource(VCSource):
    """
    Antler VC portfolio scraper.
    Antler publishes their portfolio at antler.co/portfolio
    
    This adapter demonstrates the plugin architecture:
    implementing VCSource is the ONLY requirement to add a new VC.
    The job resolver, founder enricher, storage, and dashboard
    all work automatically with zero changes.
    """
    
    name = "Antler"
    slug = "antler"
    BASE_URL = "https://www.antler.co/portfolio"

    async def list_companies_raw(self) -> list[dict]:
        """
        Fetch raw company list from Antler's portfolio page.
        Antler renders portfolio via a filterable grid — fetch and parse HTML.
        If Antler adds a public API in future, only this method changes.
        """
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                         'AppleWebKit/537.36 (KHTML, like Gecko) '
                         'Chrome/120.0.0.0 Safari/537.36'
        }
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
                r = await client.get(self.BASE_URL, headers=headers)
                r.raise_for_status()
                return self._parse_portfolio_html(r.text)
        except Exception as e:
            logger.error(f'Antler: failed to fetch portfolio: {e}')
            return []

    def _parse_portfolio_html(self, html: str) -> list[dict]:
        """
        Parse Antler portfolio grid into raw company dicts.
        Antler's portfolio cards contain: name, website, description, 
        location, industry tags, logo.
        
        NOTE: Antler's site structure may change. If this breaks,
        only this method needs updating — no other code is affected.
        """
        soup = BeautifulSoup(html, 'html.parser')
        companies = []
        
        # Antler portfolio cards — inspect antler.co/portfolio for exact selectors
        # Common patterns to try in order:
        card_selectors = [
            'div[class*="portfolio-company"]',
            'div[class*="company-card"]', 
            'a[class*="portfolio"]',
            'div[class*="startup"]',
        ]
        
        cards = []
        for selector in card_selectors:
            cards = soup.select(selector)
            if cards:
                logger.info(f'Antler: found {len(cards)} cards with selector: {selector}')
                break
        
        if not cards:
            logger.warning('Antler: no portfolio cards found — site structure may have changed')
            return []

        for card in cards:
            try:
                raw = {
                    'name': self._extract_text(card, ['h3', 'h2', '[class*="name"]']),
                    'website': self._extract_href(card),
                    'description': self._extract_text(card, ['p', '[class*="description"]']),
                    'logo_url': self._extract_img(card),
                    'location': self._extract_text(card, ['[class*="location"]', '[class*="region"]']),
                    'industry': self._extract_text(card, ['[class*="tag"]', '[class*="industry"]']),
                    'source_vc': self.name,
                }
                if raw['name']:  # only add if we got at least a name
                    companies.append(raw)
            except Exception as e:
                logger.debug(f'Antler: error parsing card: {e}')
                continue

        logger.info(f'Antler: parsed {len(companies)} companies')
        return companies

    def parse_company(self, raw: dict) -> Company:
        """
        Normalize Antler raw dict → canonical Company model.
        Field mapping is Antler-specific and lives entirely here.
        The Company model is VC-agnostic.
        """
        return Company(
            yc_id=None,          # Antler has no numeric ID — optional field
            name=raw.get('name', ''),
            slug=self._slugify(raw.get('name', '')),
            logo_url=raw.get('logo_url'),
            website=raw.get('website'),
            location=raw.get('location'),
            description=raw.get('description'),
            industry=raw.get('industry'),
            industries=[raw.get('industry')] if raw.get('industry') else [],
            source_vc=self.name,   # "Antler" — shows in UI
            is_hiring=True,        # assume hiring; job_resolver will verify
            last_scraped=datetime.utcnow(),
            data_completeness=0.0  # calculated after enrichment
        )

    async def get_founders(self, company: Company) -> list[Founder]:
        """
        Antler founder data is not publicly available in structured form.
        Returns empty list — founder_enricher.py will attempt Playwright 
        enrichment if company has a website.
        
        Future improvement: Antler cohort pages sometimes list founders.
        """
        return []

    # ── helpers ──────────────────────────────────────────────────────────────

    def _extract_text(self, el, selectors: list[str]) -> str | None:
        for sel in selectors:
            found = el.select_one(sel)
            if found and found.get_text(strip=True):
                return found.get_text(strip=True)
        return None

    def _extract_href(self, el) -> str | None:
        a = el.find('a', href=True)
        if a:
            href = a['href']
            if href.startswith('http'):
                return href
        return None

    def _extract_img(self, el) -> str | None:
        img = el.find('img', src=True)
        return img['src'] if img else None

    def _slugify(self, name: str) -> str:
        return name.lower().strip().replace(' ', '-').replace('/', '-')
