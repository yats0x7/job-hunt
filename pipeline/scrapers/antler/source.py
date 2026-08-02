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
                companies = self._parse_portfolio_html(r.text)
                
                # Check HTML for total company count to detect pagination
                soup = BeautifulSoup(r.text, 'html.parser')
                text_content = soup.get_text()
                if "Showing" in text_content and "companies" in text_content:
                    logger.info(f'Antler: fetched {len(companies)} of total companies')
                else:
                    logger.warning(f'Antler: only initial page loaded ({len(companies)} companies). Site may require JS scroll for full dataset.')
                    
                return companies
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
            'div[class*="portco_card"]',
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
                    'name': self._extract_text(card, ['h3', 'h2', '[class*="name"]', '[fs-cmsfilter-field="name"]']),
                    'website': self._extract_href(card),
                    'description': self._extract_text(card, ['p', '[class*="description"]', '[fs-cmsfilter-field="description"]']),
                    'logo_url': self._extract_img(card),
                    'location': self._extract_text(card, ['[class*="location"]', '[class*="region"]', '[fs-cmsfilter-field="location"]']),
                    'industry': self._extract_text(card, ['[class*="tag"]', '[class*="industry"]', '[fs-cmsfilter-field="sector"]']),
                    'source_vc': self.name,
                }
                if raw['name']:  # only add if we got at least a name
                    companies.append(raw)
            except Exception as e:
                logger.debug(f'Antler: error parsing card: {e}')
                continue

        seen_names = set()
        unique_companies = []
        for company in companies:
            name = company['name']
            if name and name not in seen_names:
                seen_names.add(name)
                unique_companies.append(company)
                logger.info(f'Antler: {name} | website: {company.get("website")}')

        logger.info(f'Antler: parsed {len(unique_companies)} companies')
        return unique_companies

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
        hrefs = []
        
        # Check card itself for href
        if el.get('href'): hrefs.append(el.get('href'))
        if el.get('data-href'): hrefs.append(el.get('data-href'))
        
        # Check all <a> tags inside card
        for a in el.find_all('a'):
            if a.get('href'): hrefs.append(a.get('href'))
            if a.get('data-href'): hrefs.append(a.get('data-href'))
            
        # Prefer hrefs starting with "http"
        for href in hrefs:
            if href.startswith('http'):
                return href
                
        # Fall back to hrefs starting with "/"
        for href in hrefs:
            if href.startswith('/'):
                return "https://www.antler.co" + href
                
        return None

    def _extract_img(self, el) -> str | None:
        img = el.find('img', src=True)
        return img['src'] if img else None

    def _slugify(self, name: str) -> str:
        return name.lower().strip().replace(' ', '-').replace('/', '-')
