"""
Job resolver — 4-tier cascade for resolving job board data.

Tries each tier in sequence, returning the first successful result:
  Tier 1: ATS API detection (Greenhouse, Lever, Ashby, etc.)
  Tier 2: HTML heuristics (CSS selector and link counting)
  Tier 3: LLM extraction via local Ollama
  Tier 4: Graceful skip with manual_visit fallback
"""

import asyncio
import json
import logging
import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from pipeline.storage.models import Company, JobBoardResult


# job_resolver.py — add after imports, before class JobResolver:

ATS_SLUG_OVERRIDES: dict[str, dict[str, str]] = {
    # format: "company-slug": {"ats_platform": "actual-ats-slug"}
    "deel": {"ashby": "deel"},
    "brex": {"greenhouse": "brex"},
    "rippling": {"greenhouse": "rippling"},
    "retool": {"lever": "retool"},
    "scale-ai": {"greenhouse": "scaleai"},
    "openai": {"greenhouse": "openai"},
    "notion": {"greenhouse": "notion"},
    "figma": {"greenhouse": "figma"},
    "linear": {"ashby": "linear"},
    "vercel": {"ashby": "vercel"},
    "railway": {"ashby": "railway"},
    "flock-safety": {"greenhouse": "flock-safety"},
    "go1": {"greenhouse": "go1-au"},
}


def _to_public_url(platform: str, slug: str) -> str | None:
    """Convert ATS API slug to the human-visitable job board URL.

    The API endpoint is only used to count jobs; clickable links must
    point at public boards (boards.greenhouse.io, jobs.lever.co, etc.).
    """
    if not platform or not slug:
        return None
    public_url_patterns = {
        "greenhouse": f"https://boards.greenhouse.io/{slug}",
        "lever": f"https://jobs.lever.co/{slug}",
        "ashby": f"https://jobs.ashbyhq.com/{slug}",
        "workable": f"https://apply.workable.com/{slug}",
        "smartrecruiters": f"https://jobs.smartrecruiters.com/{slug}",
    }
    return public_url_patterns.get(platform)


logger = logging.getLogger(__name__)

# ATS platform configurations
ATS_PLATFORMS = {
    "greenhouse": {
        "domains": ["greenhouse.io", "boards.greenhouse.io"],
        "api_template": "https://api.greenhouse.io/v1/boards/{slug}/jobs",
        "count_key": "jobs",  # response.jobs is the array
    },
    "lever": {
        "domains": ["jobs.lever.co", "lever.co"],
        "api_template": "https://api.lever.co/v0/postings/{slug}",
        "count_key": None,  # response itself is the array
    },
    "ashby": {
        "domains": ["jobs.ashbyhq.com"],
        "api_template": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
        "count_key": "jobs",
    },
    "workable": {
        "domains": ["workable.com"],
        "api_template": "https://{slug}.workable.com/api/v3/accounts/{slug}/jobs",
        "count_key": "results",
    },
    "smartrecruiters": {
        "domains": ["smartrecruiters.com"],
        "api_template": "https://api.smartrecruiters.com/v1/companies/{slug}/postings",
        "count_key": "content",
    },
}

# Common career page URL patterns
CAREER_URL_PATHS = ["/careers", "/jobs", "/work-with-us"]


class JobResolver:
    """
    Resolves job board information for a company using a 4-tier cascade.

    Each tier is tried in sequence; the first successful result is returned.
    This approach balances accuracy (Tier 1 ATS APIs) with coverage
    (Tier 3 LLM, Tier 4 fallback).
    """

    def __init__(self, ollama_model: str = "llama3.2:1b", ollama_timeout: int = 10):
        self._ollama_model = ollama_model
        self._ollama_timeout = ollama_timeout

    async def _find_careers_url(self, client: httpx.AsyncClient, website: str) -> str | None:
        # Step 1: HEAD the homepage
        try:
            r = await client.head(website, follow_redirects=True, timeout=5)
            if r.status_code == 403:
                # Website blocks HEAD entirely — skip path probing,
                # go straight to ATS slug guessing
                return None
        except Exception:
            return None

        # Step 2: Only try 3 paths, not 6
        for path in CAREER_URL_PATHS:
            try:
                url = website.rstrip('/') + path
                r = await client.head(url, follow_redirects=True, timeout=4)
                if r.status_code == 200:
                    return str(r.url)
            except Exception:
                continue
        return None

    def _is_spa_rendered(self, html: str) -> bool:
        spa_markers = ["__NEXT_DATA__", "next/static", "__NUXT__", 
                       "gatsby-", "__remixContext", "#jobs"]
        return any(marker in html for marker in spa_markers)

    async def resolve(self, company: Company) -> JobBoardResult:
        """
        Resolve job board data for a company through the 4-tier cascade.

        Returns the first successful JobBoardResult.
        """
        if not company.website:
            logger.debug(f"{company.name}: no website, skipping to Tier 4")
            return self._tier4_fallback(company)

        # Tier 1: ATS Detection
        result = await self._tier1_ats_detection(company)
        if result:
            logger.info(
                f"{company.name}: Tier 1 ({result.ats_platform}) → "
                f"{result.count} jobs"
            )
            return result

        # Tier 2: HTML Heuristics
        result = await self._tier2_html_heuristics(company)
        if result:
            logger.info(
                f"{company.name}: Tier 2 (html_heuristic) → {result.count} jobs"
            )
            return result

        # Tier 3: LLM Extraction
        result = await self._tier3_llm_extraction(company)
        if result:
            logger.info(
                f"{company.name}: Tier 3 (llm_extracted) → {result.count} jobs"
            )
            return result

        # Tier 4: Graceful skip
        logger.info(f"{company.name}: Tier 4 (manual_visit)")
        return self._tier4_fallback(company)

    # ─── Tier 1: ATS Detection ────────────────────────────────────────

    async def _tier1_ats_detection(self, company: Company) -> JobBoardResult | None:
        """
        Detect ATS platform and query its public API for job count.
        Target: <200ms, covers ~80% of companies.
        """
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=10.0
            ) as client:
                # Strategy 0: Check ATS_SLUG_OVERRIDES first
                if company.slug in ATS_SLUG_OVERRIDES:
                    for platform, override_slugs in ATS_SLUG_OVERRIDES[company.slug].items():
                        if isinstance(override_slugs, str):
                            override_slugs = [override_slugs]
                        for ats_slug in override_slugs:
                            result = await self._query_ats_api(client, platform, ats_slug, company)
                            if result:
                                return result

                # Strategy 1: Check website redirects for ATS domains
                ats_slug, platform = await self._detect_ats_from_website(
                    client, company
                )

                if ats_slug and platform:
                    result = await self._query_ats_api(
                        client, platform, ats_slug, company
                    )
                    if result:
                        return result

                # Strategy 2: Try common career page URLs
                ats_slug, platform = await self._detect_ats_from_career_pages(
                    client, company
                )

                if ats_slug and platform:
                    result = await self._query_ats_api(
                        client, platform, ats_slug, company
                    )
                    if result:
                        return result

                # Strategy 3: Check homepage links for ATS domains
                ats_slug, platform = await self._detect_ats_from_links(
                    client, company
                )

                if ats_slug and platform:
                    result = await self._query_ats_api(
                        client, platform, ats_slug, company
                    )
                    if result:
                        return result

                # Strategy 4: Try name-derived slugs against known ATS APIs
                result = await self._try_name_derived_slugs(client, company)
                if result:
                    return result

        except Exception as e:
            logger.debug(f"Tier 1 failed for {company.name}: {e}")

        return None

    async def _detect_ats_from_website(
        self, client: httpx.AsyncClient, company: Company
    ) -> tuple[str | None, str | None]:
        """Check website URL and redirects for ATS platform domains."""
        try:
            response = await client.head(company.website, timeout=5.0)
            final_url = str(response.url)

            for platform_name, config in ATS_PLATFORMS.items():
                for domain in config["domains"]:
                    if domain in final_url:
                        slug = self._extract_ats_slug(final_url, domain)
                        if slug:
                            return slug, platform_name

        except Exception:
            pass

        return None, None

    async def _detect_ats_from_career_pages(
        self, client: httpx.AsyncClient, company: Company
    ) -> tuple[str | None, str | None]:
        """Check common career page URLs for ATS redirects."""
        if not company.website:
            return None, None

        final_url = await self._find_careers_url(client, company.website)
        if final_url:
            for platform_name, config in ATS_PLATFORMS.items():
                for domain in config["domains"]:
                    if domain in final_url:
                        slug = self._extract_ats_slug(final_url, domain)
                        if slug:
                            return slug, platform_name

        return None, None

    async def _detect_ats_from_links(
        self, client: httpx.AsyncClient, company: Company
    ) -> tuple[str | None, str | None]:
        """Parse homepage HTML for links to ATS platforms."""
        try:
            response = await client.get(company.website, timeout=5.0)
            if response.status_code != 200:
                return None, None

            soup = BeautifulSoup(response.text, "html.parser")

            for link in soup.find_all("a", href=True):
                href = link["href"]
                for platform_name, config in ATS_PLATFORMS.items():
                    for domain in config["domains"]:
                        if domain in href:
                            slug = self._extract_ats_slug(href, domain)
                            if slug:
                                return slug, platform_name

        except Exception:
            pass

        return None, None

    async def _try_name_derived_slugs(
        self, client: httpx.AsyncClient, company: Company
    ) -> JobBoardResult | None:
        """Try name-derived slugs against known ATS APIs."""
        # Generate slug candidates from company name
        slug_candidates = self._derive_slugs(company.slug)

        # Only try the most common ATS platforms to avoid excessive requests
        for platform in ["greenhouse", "lever"]:
            for slug in slug_candidates:
                result = await self._query_ats_api(client, platform, slug, company)
                if result:
                    return result

        return None

    @staticmethod
    def _derive_slugs(company_slug: str) -> list[str]:
        """Generate ATS slug candidates from a company slug."""
        slug = company_slug.lower().strip()

        slugs = [
            slug,                                  # as-is
            slug.replace("-", ""),                 # hyphens removed
            slug.replace("-", "_"),                # hyphens replaced by underscores
        ]
        return list(dict.fromkeys(slugs))  # deduplicate preserving order

    @staticmethod
    def _extract_ats_slug(url: str, domain: str) -> str | None:
        """Extract the company slug from an ATS URL."""
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]

        # For subdomain-based ATS (e.g., company.workable.com)
        if parsed.hostname and parsed.hostname != domain:
            subdomain = parsed.hostname.replace(f".{domain}", "").split(".")[0]
            if subdomain and subdomain not in ("www", "api", "jobs", "boards"):
                return subdomain

        # For path-based ATS (e.g., jobs.lever.co/company)
        if path_parts:
            return path_parts[0]

        return None

    async def _query_ats_api(
        self, client: httpx.AsyncClient, platform: str, slug: str, company: Company = None
    ) -> JobBoardResult | None:
        """Query an ATS public API and return job count."""
        config = ATS_PLATFORMS.get(platform)
        if not config:
            return None

        api_url = config["api_template"].format(slug=slug)

        try:
            response = await client.get(api_url, timeout=5.0)
            if response.status_code != 200:
                return None

            data = response.json()

            # Extract job count based on ATS response structure
            count_key = config["count_key"]
            if count_key is None:
                # Response is directly a list (Lever)
                if isinstance(data, list):
                    count = len(data)
                else:
                    return None
            else:
                jobs_data = data.get(count_key, [])
                if isinstance(jobs_data, list):
                    count = len(jobs_data)
                elif isinstance(jobs_data, int):
                    count = jobs_data
                else:
                    return None

            if company and count == 0 and getattr(company, "is_hiring", False):
                logger.debug(
                    f"ATS API for {platform}/{slug} returned 0 jobs but company is hiring, skipping"
                )
                return None

            # Never expose api_url — it returns raw JSON, not a job board page.
            public_url = _to_public_url(platform, slug)
            if not public_url:
                logger.debug(
                    f"No public URL mapping for ATS platform={platform!r} slug={slug!r}"
                )
                return None

            return JobBoardResult(
                count=count,
                url=public_url,
                source_type="ats_api",
                ats_platform=platform,
            )

        except Exception as e:
            logger.debug(f"ATS API query failed ({platform}/{slug}): {e}")
            return None

    # ─── Tier 2: HTML Heuristics ──────────────────────────────────────

    async def _tier2_html_heuristics(
        self, company: Company
    ) -> JobBoardResult | None:
        """
        Count job listings using CSS selectors and link patterns.
        Target: <50ms additional processing time.
        """
        careers_url = None
        html = None

        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=10.0
            ) as client:
                if not company.website:
                    return None
                    
                careers_url = await self._find_careers_url(client, company.website)
                if not careers_url:
                    return None
                    
                response = await client.get(careers_url, timeout=5.0)
                if response.status_code == 200:
                    html = response.text
                
                if not html:
                    return None

        except Exception as e:
            logger.debug(f"Tier 2 fetch failed for {company.name}: {e}")
            return None

        if self._is_spa_rendered(html):
            logger.debug(f'SPA detected for {company.name}, escalating to Tier 3')
            return None

        soup = BeautifulSoup(html, "html.parser")

        # Count using CSS selectors for job-related classes
        job_selectors = [
            "[class*='job']",
            "[class*='position']",
            "[class*='opening']",
            "[class*='posting']",
            "[class*='career-item']",
            "[class*='role']",
            "[href*='/positions']",
            "[href*='/careers/positions']",
        ]

        selector_count = 0
        for selector in job_selectors:
            elements = soup.select(selector)
            # Filter to likely job listing elements (not navigation, headers etc)
            for el in elements:
                text = el.get_text(strip=True)
                if text and len(text) > 10:
                    selector_count += 1

        # Count using href patterns
        job_link_patterns = ["/jobs/", "/careers/", "/positions/", "/openings/"]
        href_count = 0
        seen_urls = set()

        for link in soup.find_all("a", href=True):
            href = link["href"]
            for pattern in job_link_patterns:
                if pattern in href and href not in seen_urls:
                    seen_urls.add(href)
                    href_count += 1
                    break

        # Validation: if counts disagree significantly, escalate
        if selector_count > 0 and href_count > 0:
            ratio = min(selector_count, href_count) / max(selector_count, href_count)
            if ratio < 0.7:  # >30% disagreement
                logger.debug(
                    f"Tier 2 count mismatch for {company.name}: "
                    f"selector={selector_count}, href={href_count}"
                )
                return None

        count = max(selector_count, href_count)

        # If we found a careers page but zero jobs, escalate
        if count == 0:
            return None

        return JobBoardResult(
            count=count,
            url=careers_url,
            source_type="html_heuristic",
        )

    # ─── Tier 3: LLM Extraction ──────────────────────────────────────

    async def _tier3_llm_extraction(
        self, company: Company
    ) -> JobBoardResult | None:
        """
        Use local Ollama LLM to extract job count from careers page HTML.
        Model: llama3.2:1b (fast, local). Timeout: 10 seconds.
        """
        # First, fetch and prepare the careers page content
        page_text = await self._fetch_careers_page_text(company)
        if not page_text:
            return None

        # Truncate to ~2000 tokens worth of text
        page_text = page_text[:6000]  # rough approximation

        from pipeline.enrichment.llm_fallback import extract_job_count_from_text
        
        job_count = await asyncio.to_thread(extract_job_count_from_text, page_text)
        
        if job_count is None:
            return None

        return JobBoardResult(
            count=job_count,
            url=f"{company.website.rstrip('/')}/careers" if company.website else None,
            source_type="llm_extracted",
        )

    async def _fetch_careers_page_text(self, company: Company) -> str | None:
        """Fetch and strip careers page HTML to meaningful text content."""
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=10.0
            ) as client:
                base = company.website.rstrip("/")

                for path in CAREER_URL_PATHS:
                    try:
                        response = await client.get(
                            f"{base}{path}", timeout=5.0
                        )
                        if response.status_code == 200:
                            soup = BeautifulSoup(response.text, "html.parser")

                            # Strip to meaningful content
                            for tag in soup(
                                ["script", "style", "nav", "footer", "header"]
                            ):
                                tag.decompose()

                            # Focus on main content areas
                            main = soup.find(["main", "article"]) or soup.body
                            if not main:
                                continue

                            # Extract headings and links
                            parts = []
                            for el in main.find_all(
                                ["h1", "h2", "h3", "h4", "a", "p", "li", "span"]
                            ):
                                text = el.get_text(strip=True)
                                if text and len(text) > 3:
                                    if el.name == "a" and el.get("href"):
                                        parts.append(
                                            f"[{text}]({el['href']})"
                                        )
                                    else:
                                        parts.append(text)

                            if parts:
                                return "\n".join(parts)

                    except Exception:
                        continue

        except Exception:
            pass

        return None

    # ─── Tier 4: Graceful Skip ────────────────────────────────────────

    @staticmethod
    def _tier4_fallback(company: Company) -> JobBoardResult:
        """Return a fallback result pointing to the company's careers page."""
        base = (company.website or "").rstrip("/")
        return JobBoardResult(
            count=None,
            url=f"{base}/careers" if base else None,
            source_type="manual_visit",
        )
