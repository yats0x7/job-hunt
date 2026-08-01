"""
YCSource — VCSource implementation for Y Combinator.

Fetches company data from Algolia and enriches with founder info
scraped from individual YC company pages.
"""

import logging
import re

import httpx
from bs4 import BeautifulSoup

from pipeline.scrapers.base import VCSource
from pipeline.scrapers.yc.algolia_client import AlgoliaClient
from pipeline.scrapers.yc.company_parser import parse_algolia_hit
from pipeline.storage.models import Company, Founder

logger = logging.getLogger(__name__)

YC_COMPANY_URL = "https://www.ycombinator.com/companies/{slug}"


class YCSource(VCSource):
    """
    Y Combinator source — fetches from Algolia index and enriches
    with founder data scraped from YC company pages.
    """

    name = "Y Combinator"
    slug = "yc"

    def __init__(self):
        self._algolia = AlgoliaClient()

    async def list_companies_raw(self) -> list[dict]:
        """Fetch all active companies from the YC Algolia index."""
        return await self._algolia.fetch_all_companies()

    def parse_company(self, raw: dict) -> Company:
        """Normalize Algolia hit into canonical Company model."""
        return parse_algolia_hit(raw)

    async def get_founders(self, company: Company) -> list[Founder]:
        """
        Scrape founder info from the YC company page.

        The YC company page at /companies/{slug} includes founder sections
        with name, photo, college/university, and LinkedIn links.
        """
        url = YC_COMPANY_URL.format(slug=company.slug)
        founders: list[Founder] = []

        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=15.0
            ) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    logger.warning(
                        f"Failed to fetch founders for {company.name}: "
                        f"HTTP {response.status_code}"
                    )
                    return founders

                soup = BeautifulSoup(response.text, "html.parser")
                founders = self._parse_founders_from_html(soup)

        except httpx.TimeoutException:
            logger.warning(f"Timeout fetching founders for {company.name}")
        except Exception as e:
            logger.warning(
                f"Error fetching founders for {company.name}: {e}"
            )

        return founders

    @staticmethod
    def _parse_founders_from_html(soup: BeautifulSoup) -> list[Founder]:
        """
        Extract founder data from YC company page HTML.

        Looks for founder sections which typically contain:
        - Name in heading/text elements
        - Photo in <img> tags
        - LinkedIn in <a> links
        - College/university info in text
        """
        founders: list[Founder] = []

        # YC pages use various structures — try multiple selectors
        # Strategy 1: Look for founder-specific sections
        founder_sections = soup.find_all(
            "div",
            class_=re.compile(r"founder|team-member|person", re.IGNORECASE),
        )

        if not founder_sections:
            # Strategy 2: Look for sections with founder-like headings
            for heading in soup.find_all(["h2", "h3", "h4"]):
                text = heading.get_text(strip=True).lower()
                if "founder" in text or "team" in text:
                    # Get the parent section
                    section = heading.find_parent(["section", "div"])
                    if section:
                        founder_sections = section.find_all("div", recursive=False)
                    break

        if not founder_sections:
            # Strategy 3: Look for LinkedIn links as anchor points
            linkedin_links = soup.find_all(
                "a", href=re.compile(r"linkedin\.com/in/", re.IGNORECASE)
            )
            for link in linkedin_links:
                parent = link.find_parent("div")
                if parent:
                    founder_sections.append(parent)

        for section in founder_sections:
            founder = _extract_founder_from_element(section)
            if founder and founder.name:
                founders.append(founder)

        return founders


def _extract_founder_from_element(element) -> Founder | None:
    """Extract a single Founder from an HTML element."""
    # Find name — look for heading or bold text
    name = None
    for tag in element.find_all(["h3", "h4", "h5", "strong", "b", "span"]):
        text = tag.get_text(strip=True)
        if text and len(text) < 80 and not text.startswith("http"):
            name = text
            break

    if not name:
        # Fallback: first meaningful text node
        text = element.get_text(strip=True)
        if text:
            # Take first line/sentence as name
            name = text.split("\n")[0].strip()
            if len(name) > 80:
                name = None

    if not name:
        return None

    # Find photo
    photo_url = None
    img = element.find("img")
    if img:
        photo_url = img.get("src") or img.get("data-src")

    # Find LinkedIn
    linkedin_url = None
    linkedin_link = element.find(
        "a", href=re.compile(r"linkedin\.com", re.IGNORECASE)
    )
    if linkedin_link:
        linkedin_url = linkedin_link["href"]

    # Find college — look for common university indicators
    college = None
    text_content = element.get_text(" ", strip=True)
    university_patterns = [
        r"(?:University|Institute|College|School) of [A-Z][a-zA-Z\s]+",
        r"(?:MIT|Stanford|Harvard|Yale|Princeton|Berkeley|Caltech|CMU|NYU|UCLA)",
        r"[A-Z][a-z]+ (?:University|Institute|College)",
    ]
    for pattern in university_patterns:
        match = re.search(pattern, text_content)
        if match:
            college = match.group(0).strip()
            break

    return Founder(
        name=name,
        college=college,
        photo_url=photo_url,
        linkedin_url=linkedin_url,
    )
